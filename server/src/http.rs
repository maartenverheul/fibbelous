use std::convert::Infallible;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

use http_body_util::BodyExt;
use hyper::body::Incoming;
use hyper::{Method, Request, Response, StatusCode};
use jsonrpsee::core::http_helpers::{Body, Response as RpcResponse};
use jsonrpsee::server::ws;
use jsonrpsee::server::{Methods, Server, ServerHandle, serve_with_graceful_shutdown, stop_channel};
use tower::Service;
use tower::service_fn;

use crate::rpc::{WorkspaceRpcState, build_workspace_module};
use crate::workspace::{
    CreateWorkspaceError, CreateWorkspaceRequest, UpdateWorkspaceError, UpdateWorkspaceRequest,
    Workspace, create_workspace, find_by_id, find_by_id_mut, spawn_indexing,
};

type RpcServiceBuilder = jsonrpsee::server::TowerServiceBuilder<
    tower::layer::util::Identity,
    tower::layer::util::Identity,
>;

#[derive(Clone)]
pub struct AppState {
    pub workspaces: Arc<RwLock<Vec<Workspace>>>,
    pub workspaces_dir: PathBuf,
    pub svc_builder: RpcServiceBuilder,
}

pub async fn run_server(
    addr: SocketAddr,
    workspaces: Arc<RwLock<Vec<Workspace>>>,
    workspaces_dir: PathBuf,
) -> Result<ServerHandle, Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let (stop_handle, server_handle) = stop_channel();
    let svc_builder = Server::builder().to_service_builder();
    let app_state = AppState {
        workspaces,
        workspaces_dir,
        svc_builder,
    };

    tokio::spawn(async move {
        loop {
            let accept = tokio::select! {
                result = listener.accept() => result,
                _ = stop_handle.clone().shutdown() => break,
            };

            let (stream, remote_addr) = match accept {
                Ok(pair) => pair,
                Err(error) => {
                    tracing::error!(%error, "failed to accept connection");
                    continue;
                }
            };

            let stop_handle = stop_handle.clone();
            let app_state = app_state.clone();

            let stop_handle_rpc = stop_handle.clone();
            let stop_handle_shutdown = stop_handle.clone();

            tokio::spawn(async move {
                let svc_builder = app_state.svc_builder.clone();
                let service = service_fn(move |req: Request<Incoming>| {
                    let stop_handle = stop_handle_rpc.clone();
                    let svc_builder = svc_builder.clone();
                    let app_state = app_state.clone();

                    async move {
                        if req.method() == Method::OPTIONS {
                            return Ok::<_, Infallible>(with_cors(&req, preflight_response()));
                        }

                        let method = req.method().clone();
                        let path = req.uri().path().to_string();

                        if method == Method::GET && (path == "/workspaces" || path == "/health") {
                            if let Some(response) = handle_get_rest(&req, &app_state) {
                                return Ok::<_, Infallible>(with_cors(&req, response));
                            }
                        }

                        if method == Method::POST && path == "/workspaces" {
                            return Ok::<_, Infallible>(
                                handle_create_workspace(req, &app_state).await,
                            );
                        }

                        if method == Method::PATCH && path.starts_with("/workspaces/") {
                            let workspace_id = path.trim_start_matches("/workspaces/");
                            if !workspace_id.is_empty() && !workspace_id.contains('/') {
                                return Ok::<_, Infallible>(
                                    handle_update_workspace(
                                        req,
                                        &app_state,
                                        workspace_id.to_string(),
                                    )
                                    .await,
                                );
                            }
                        }

                        if ws::is_upgrade_request(&req) {
                            let path = req.uri().path().to_string();
                            let workspace_id = path.trim_start_matches('/');

                            if workspace_id.is_empty() || workspace_id.contains('/') {
                                return Ok::<_, Infallible>(with_cors(&req, not_found_response()));
                            }

                            let workspace_id = workspace_id.to_string();
                            let workspace = {
                                let workspaces =
                                    app_state.workspaces.read().expect("workspaces lock poisoned");
                                find_by_id(&workspaces, &workspace_id).cloned()
                            };

                            let Some(workspace) = workspace else {
                                return Ok::<_, Infallible>(with_cors(&req, not_found_response()));
                            };

                            let module = build_workspace_module(WorkspaceRpcState { workspace });
                            let methods: Methods = module.into();
                            let mut rpc_service =
                                svc_builder.build(methods, stop_handle.clone());
                            let origin = req
                                .headers()
                                .get(hyper::header::ORIGIN)
                                .cloned();

                            return match rpc_service.call(req).await {
                                Ok(response) => {
                                    Ok::<_, Infallible>(with_cors_origin(origin, response))
                                }
                                Err(error) => {
                                    tracing::warn!(
                                        %error,
                                        workspace = %workspace_id,
                                        "websocket rpc failed"
                                    );
                                    Ok::<_, Infallible>(with_cors_origin(
                                        origin,
                                        internal_error_response(),
                                    ))
                                }
                            };
                        }

                        Ok::<_, Infallible>(with_cors(&req, not_found_response()))
                    }
                });

                if let Err(error) = serve_with_graceful_shutdown(
                    stream,
                    service,
                    stop_handle_shutdown.shutdown(),
                )
                .await
                {
                    tracing::debug!(%remote_addr, %error, "connection closed");
                }
            });
        }
    });

    Ok(server_handle)
}

fn handle_get_rest(req: &Request<Incoming>, state: &AppState) -> Option<RpcResponse> {
    let path = req.uri().path();

    if req.method() == Method::GET && path == "/workspaces" {
        let workspaces = state.workspaces.read().expect("workspaces lock poisoned");
        let items: Vec<_> = workspaces.iter().map(|workspace| workspace.info()).collect();
        return Some(json_response(StatusCode::OK, items));
    }

    if req.method() == Method::GET && path == "/health" {
        return Some(json_response(
            StatusCode::OK,
            serde_json::json!({ "status": "ok" }),
        ));
    }

    None
}

async fn handle_create_workspace(
    req: Request<Incoming>,
    state: &AppState,
) -> RpcResponse {
    let origin = req.headers().get(hyper::header::ORIGIN).cloned();
    let body = match req.into_body().collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(error) => {
            tracing::warn!(%error, "failed to read create workspace request body");
            return with_cors_origin(
                origin,
                json_error(StatusCode::BAD_REQUEST, "invalid request body"),
            );
        }
    };

    let input = match serde_json::from_slice::<CreateWorkspaceRequest>(&body) {
        Ok(input) => input,
        Err(error) => {
            return with_cors_origin(
                origin,
                json_error(StatusCode::BAD_REQUEST, error.to_string()),
            );
        }
    };

    let created = {
        let existing = state.workspaces.read().expect("workspaces lock poisoned");
        create_workspace(&state.workspaces_dir, &existing, input)
    };

    with_cors_origin(
        origin,
        match created {
            Ok(workspace) => {
                let info = workspace.info();
                state
                    .workspaces
                    .write()
                    .expect("workspaces lock poisoned")
                    .push(workspace.clone());
                spawn_indexing(workspace);
                json_response(StatusCode::CREATED, info)
            }
            Err(CreateWorkspaceError::SlugConflict) => {
                json_error(StatusCode::CONFLICT, "slug already exists")
            }
            Err(CreateWorkspaceError::Validation(message)) => {
                json_error(StatusCode::BAD_REQUEST, message)
            }
            Err(CreateWorkspaceError::Io(error)) => {
                tracing::warn!(%error, "failed to create workspace");
                json_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to create workspace",
                )
            }
        },
    )
}

async fn handle_update_workspace(
    req: Request<Incoming>,
    state: &AppState,
    workspace_id: String,
) -> RpcResponse {
    let origin = req.headers().get(hyper::header::ORIGIN).cloned();
    let body = match req.into_body().collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(error) => {
            tracing::warn!(%error, "failed to read update workspace request body");
            return with_cors_origin(
                origin,
                json_error(StatusCode::BAD_REQUEST, "invalid request body"),
            );
        }
    };

    let input = match serde_json::from_slice::<UpdateWorkspaceRequest>(&body) {
        Ok(input) => input,
        Err(error) => {
            return with_cors_origin(
                origin,
                json_error(StatusCode::BAD_REQUEST, error.to_string()),
            );
        }
    };

    let mut workspaces = state.workspaces.write().expect("workspaces lock poisoned");
    let snapshot = workspaces.clone();
    let Some(workspace) = find_by_id_mut(&mut workspaces, &workspace_id) else {
        return with_cors_origin(origin, json_error(StatusCode::NOT_FOUND, "workspace not found"));
    };

    let updated = workspace.update_settings(&snapshot, input);

    with_cors_origin(
        origin,
        match updated {
            Ok(info) => json_response(StatusCode::OK, info),
            Err(UpdateWorkspaceError::SlugConflict) => {
                json_error(StatusCode::CONFLICT, "slug already exists")
            }
            Err(UpdateWorkspaceError::Validation(message)) => {
                json_error(StatusCode::BAD_REQUEST, message)
            }
            Err(UpdateWorkspaceError::NotFound) => {
                json_error(StatusCode::NOT_FOUND, "workspace not found")
            }
            Err(UpdateWorkspaceError::Io(error)) => {
                tracing::warn!(%error, workspace = %workspace_id, "failed to update workspace");
                json_error(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to update workspace",
                )
            }
        },
    )
}

fn preflight_response() -> RpcResponse {
    Response::builder()
        .status(StatusCode::NO_CONTENT)
        .body(Body::empty())
        .unwrap()
}

fn with_cors(req: &Request<Incoming>, response: RpcResponse) -> RpcResponse {
    let origin = req.headers().get(hyper::header::ORIGIN).cloned();
    with_cors_origin(origin, response)
}

fn with_cors_origin(
    origin: Option<hyper::header::HeaderValue>,
    mut response: RpcResponse,
) -> RpcResponse {
    let origin =
        origin.unwrap_or_else(|| hyper::header::HeaderValue::from_static("*"));

    response.headers_mut().insert(hyper::header::ACCESS_CONTROL_ALLOW_ORIGIN, origin);
    response.headers_mut().insert(
        hyper::header::ACCESS_CONTROL_ALLOW_METHODS,
        hyper::header::HeaderValue::from_static("GET, POST, PATCH, OPTIONS"),
    );
    response.headers_mut().insert(
        hyper::header::ACCESS_CONTROL_ALLOW_HEADERS,
        hyper::header::HeaderValue::from_static("content-type"),
    );
    response
}

fn json_response(status: StatusCode, body: impl serde::Serialize) -> RpcResponse {
    let body = serde_json::to_vec(&body).unwrap_or_default();
    Response::builder()
        .status(status)
        .header("content-type", "application/json")
        .body(Body::from(body))
        .unwrap_or_else(|_| not_found_response())
}

fn json_error(status: StatusCode, message: impl Into<String>) -> RpcResponse {
    json_response(status, serde_json::json!({ "error": message.into() }))
}

fn not_found_response() -> RpcResponse {
    text_response(StatusCode::NOT_FOUND, "not found")
}

fn internal_error_response() -> RpcResponse {
    text_response(StatusCode::INTERNAL_SERVER_ERROR, "internal error")
}

fn text_response(status: StatusCode, body: &str) -> RpcResponse {
    Response::builder()
        .status(status)
        .header("content-type", "text/plain; charset=utf-8")
        .body(Body::from(body.to_string()))
        .unwrap_or_else(|_| {
            Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::empty())
                .unwrap()
        })
}

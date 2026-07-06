use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;

use hyper::body::Incoming;
use hyper::{Method, Request, Response, StatusCode};
use jsonrpsee::core::http_helpers::{Body, Response as RpcResponse};
use jsonrpsee::server::ws;
use jsonrpsee::server::{Methods, Server, ServerHandle, serve_with_graceful_shutdown, stop_channel};
use tower::Service;
use tower::service_fn;

use crate::rpc::{WorkspaceRpcState, build_workspace_module};
use crate::workspace::{find_by_id, Workspace};

type RpcServiceBuilder = jsonrpsee::server::TowerServiceBuilder<
    tower::layer::util::Identity,
    tower::layer::util::Identity,
>;

#[derive(Clone)]
pub struct AppState {
    pub workspaces: Arc<Vec<Workspace>>,
    pub svc_builder: RpcServiceBuilder,
}

pub async fn run_server(
    addr: SocketAddr,
    workspaces: Arc<Vec<Workspace>>,
) -> Result<ServerHandle, Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind(addr).await?;
    let (stop_handle, server_handle) = stop_channel();
    let svc_builder = Server::builder().to_service_builder();
    let app_state = AppState {
        workspaces,
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

                        if let Some(response) = try_handle_rest(&req, &app_state) {
                            return Ok::<_, Infallible>(with_cors(&req, response));
                        }

                        if ws::is_upgrade_request(&req) {
                            let path = req.uri().path().to_string();
                            let workspace_id = path.trim_start_matches('/');

                            if workspace_id.is_empty() || workspace_id.contains('/') {
                                return Ok::<_, Infallible>(with_cors(&req, not_found_response()));
                            }

                            let workspace_id = workspace_id.to_string();
                            let Some(workspace) = find_by_id(&app_state.workspaces, &workspace_id)
                            else {
                                return Ok::<_, Infallible>(with_cors(&req, not_found_response()));
                            };

                            let module = build_workspace_module(WorkspaceRpcState {
                                workspace: workspace.clone(),
                            });
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

fn try_handle_rest(req: &Request<Incoming>, state: &AppState) -> Option<RpcResponse> {
    let path = req.uri().path();

    if req.method() == Method::GET && path == "/workspaces" {
        let workspaces: Vec<_> = state.workspaces.iter().map(|w| w.info()).collect();
        return Some(json_response(StatusCode::OK, workspaces));
    }

    if req.method() == Method::GET && path == "/health" {
        return Some(json_response(
            StatusCode::OK,
            serde_json::json!({ "status": "ok" }),
        ));
    }

    None
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
        hyper::header::HeaderValue::from_static("GET, OPTIONS"),
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

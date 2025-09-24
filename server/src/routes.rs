use std::sync::Arc;

use crate::ws; // Import AppState from the appropriate module
use axum::extract::{Json, Path, State};
use axum::routing::{get, post};
use axum::{response::IntoResponse, Router};
use fib_core::command_handler::{Command, CommandHandler, CommandResult};
use fib_core::state::AppState;
use fib_core::workspaces::{CreateWorkspaceRequest, WorkspaceInfo};
use hyper::StatusCode;
use tower_http::cors::{Any, CorsLayer};

pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/", get(|| async { "Hello, world!" }))
        .route("/api/hello", get(hello))
        // WebSocket endpoint for real-time events / messages
        .route("/ws", get(ws::ws_handler))
        .route(
            "/api/workspaces",
            get(list_workspaces).post(create_workspace),
        )
        .route(
            "/api/workspaces/:id",
            get(get_workspace)
                .put(update_workspace)
                .delete(remove_workspace),
        )
        .route(
            "/api/workspaces/:id/pages/:page_id",
            axum::routing::patch(update_page),
        )
        // TODO: add pages endpoints
        .route("/api/workspaces/:id/toc", post(make_toc))
        .layer(cors)
        .with_state(state)
}

pub async fn list_workspaces(State(state): State<AppState>) -> impl IntoResponse {
    let first = {
        let guard = state.workspace_manager.workspaces.read().await;
        guard.values().next().cloned()
    };
    if let Some(ws) = first {
        let handler = CommandHandler::new(state.clone(), ws);
        match handler.execute(Command::GetSavedWorkspaces).await {
            CommandResult::Workspaces(w) => Json(w.workspaces).into_response(),
            CommandResult::Error(e) => {
                (StatusCode::INTERNAL_SERVER_ERROR, e.message).into_response()
            }
            other => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Unexpected result: {:?}", other),
            )
                .into_response(),
        }
    } else {
        Json(Vec::<WorkspaceInfo>::new()).into_response()
    }
}

// Simple hello endpoint for connection testing
pub async fn hello() -> impl IntoResponse {
    println!("Received hello request");
    (StatusCode::OK, "Hello from server!")
}

pub async fn create_workspace(
    State(state): State<AppState>,
    Json(request): Json<CreateWorkspaceRequest>,
) -> impl IntoResponse {
    // Build WorkspaceInfo-like object first via workspaces::create_workspace_from_request
    match state
        .workspace_manager
        .create_workspace_from_request(request)
        .await
    {
        Ok(loaded) => {
            let info = loaded.info.clone();
            {
                let mut guard = state.workspace_manager.workspaces.write().await;
                guard.insert(loaded.id.clone(), Arc::new(loaded));
            }
            (StatusCode::CREATED, Json(info)).into_response()
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

pub async fn get_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let ws_arc = {
        let guard = state.workspace_manager.workspaces.read().await;
        guard
            .get(&id)
            .cloned()
            .or_else(|| guard.values().next().cloned())
    };
    if let Some(ws) = ws_arc {
        let handler = CommandHandler::new(state.clone(), ws);
        match handler.execute(Command::GetWorkspace { id }).await {
            CommandResult::Workspace(info) => Json(info).into_response(),
            CommandResult::Error(e) => {
                if e.message.contains("removed (file missing)") || e.message.contains("not found") {
                    (StatusCode::NOT_FOUND, e.message).into_response()
                } else {
                    (StatusCode::INTERNAL_SERVER_ERROR, e.message).into_response()
                }
            }
            other => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Unexpected result: {:?}", other),
            )
                .into_response(),
        }
    } else {
        (StatusCode::NOT_FOUND, "workspace not found").into_response()
    }
}

pub async fn update_workspace(Path(id): Path<String>) -> impl IntoResponse {
    format!("Update workspace with id: {}", id)
}

pub async fn remove_workspace(Path(id): Path<String>) -> impl IntoResponse {
    format!("Delete workspace with id: {}", id)
}

pub async fn make_toc(Path(id): Path<String>) -> impl IntoResponse {
    format!("Make TOC for workspace with id: {}", id)
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePageRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub icon: Option<String>,
}

pub async fn update_page(
    State(state): State<AppState>,
    Path((workspace_id, page_id)): Path<(String, String)>,
    Json(req): Json<UpdatePageRequest>,
) -> impl IntoResponse {
    // Find workspace arc
    let workspace = {
        let guard = state.workspace_manager.workspaces.read().await;
        guard.get(&workspace_id).cloned()
    };
    let Some(ws) = workspace else {
        return (
            StatusCode::NOT_FOUND,
            format!("Workspace {} not found", workspace_id),
        )
            .into_response();
    };

    let handler = CommandHandler::new(state.clone(), ws);
    let result = handler
        .execute(Command::UpdatePage {
            page_id: page_id.clone(),
            title: req.title,
            content: req.content,
            icon: req.icon,
        })
        .await;

    match result {
        CommandResult::Page(page) => (StatusCode::OK, Json(page)).into_response(),
        CommandResult::Error(e) => {
            if e.message.contains("not found") {
                (StatusCode::NOT_FOUND, e.message).into_response()
            } else {
                (StatusCode::INTERNAL_SERVER_ERROR, e.message).into_response()
            }
        }
        other => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Unexpected result: {:?}", other),
        )
            .into_response(),
    }
}

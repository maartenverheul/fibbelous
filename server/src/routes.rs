use std::sync::Arc;

use crate::ws; // Import AppState from the appropriate module
use axum::extract::{Json, Path, State};
use axum::routing::get;
use axum::{response::IntoResponse, Router};
use fib_core::command_handler::{Command, CommandHandler, CommandResult};
use fib_core::state::AppState;
use fib_core::workspaces::CreateWorkspaceRequest;
use hyper::StatusCode;
use tower_http::cors::{Any, CorsLayer};

pub fn build_router(state: Arc<AppState>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/", get(|| async { "Fibbelous server is running" }))
        // WebSocket endpoint for real-time events / messages
        .route("/ws", get(ws::ws_handler))
        .route(
            "/api/workspaces",
            get(list_workspaces).post(create_workspace),
        )
        .route("/api/workspaces/:workspace_id", get(get_workspace))
        .layer(cors)
        .with_state(state)
}

pub async fn list_workspaces(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let handler = CommandHandler::new(state.clone(), None);
    let result = handler.execute(Command::GetSavedWorkspaces).await;
    match result {
        CommandResult::Workspaces(wss) => (StatusCode::OK, Json(wss)).into_response(),
        CommandResult::Error(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.message).into_response(),
        other => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Unexpected result: {:?}", other),
        )
            .into_response(),
    }
}

pub async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateWorkspaceRequest>,
) -> impl IntoResponse {
    let handler = CommandHandler::new(state.clone(), None);
    let result = handler
        .execute(Command::CreateWorkspace { request: req })
        .await;
    match result {
        CommandResult::Workspace(ws) => (StatusCode::CREATED, Json(ws)).into_response(),
        CommandResult::Error(e) => (StatusCode::BAD_REQUEST, e.message).into_response(),
        other => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Unexpected result: {:?}", other),
        )
            .into_response(),
    }
}

pub async fn get_workspace(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
) -> impl IntoResponse {
    let handler = CommandHandler::new(state.clone(), None);
    let result = handler
        .execute(Command::GetWorkspace { id: workspace_id })
        .await;
    match result {
        CommandResult::Workspace(ws) => (StatusCode::OK, Json(ws)).into_response(),
        CommandResult::Error(e) => (StatusCode::NOT_FOUND, e.message).into_response(),
        other => (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Unexpected result: {:?}", other),
        )
            .into_response(),
    }
}

#[allow(dead_code)]
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePageRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub icon: Option<String>,
}

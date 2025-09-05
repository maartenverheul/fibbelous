use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{response::IntoResponse, Json, Router};
use tower_http::cors::{Any, CorsLayer};

use crate::{ws, AppState};

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
            "/api/workspaces/:id/pages",
            get(list_workspaces).post(create_workspace),
        )
        .route("/api/workspaces/:id/toc", post(make_toc))
        .layer(cors)
        .with_state(state)
}

pub async fn list_workspaces(State(state): State<AppState>) -> impl IntoResponse {
    let list: Vec<lib::workspaces::WorkspaceInfo> =
        state.workspaces.values().map(|w| w.info.clone()).collect();
    Json(list).into_response()
}

// Simple hello endpoint for connection testing
pub async fn hello() -> impl IntoResponse {
    println!("Received hello request");
    (axum::http::StatusCode::OK, "Hello from server!")
}

pub async fn create_workspace(State(state): State<AppState>) -> impl IntoResponse {
    (
        axum::http::StatusCode::CREATED,
        "Workspace created (placeholder)",
    )
        .into_response()
}

pub async fn get_workspace(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    format!("Get workspace with id: {}", id)
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

use crate::ws; // Import AppState from the appropriate module
use axum::extract::{Json, Path, State};
use axum::routing::{get, post};
use axum::{response::IntoResponse, Router};
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
        // TODO: add pages endpoints
        .route("/api/workspaces/:id/toc", post(make_toc))
        .layer(cors)
        .with_state(state)
}

pub async fn list_workspaces(State(state): State<AppState>) -> impl IntoResponse {
    let guard = state.workspaces.read().await;
    let list: Vec<WorkspaceInfo> = guard.values().map(|w| w.info.clone()).collect();
    Json(list).into_response()
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
    match state.add_workspace_from_request(request).await {
        Ok(ws) => (StatusCode::CREATED, Json(ws)).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e).into_response(),
    }
}

pub async fn get_workspace(
    State(_state): State<AppState>,
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

use axum::extract::Path;
use axum::{Json, Router, response::IntoResponse, routing::get, serve};
use std::net::SocketAddr;

// Placeholder handlers for CRUD endpoints
async fn list_workspaces() -> impl IntoResponse {
    match lib::workspaces::list() {
        Ok(list) => Json(list).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to list workspaces: {}", e),
        )
            .into_response(),
    }
}

async fn create_workspace() -> impl IntoResponse {
    "Create workspace (placeholder)"
}

async fn get_workspace(Path(id): Path<String>) -> impl IntoResponse {
    format!("Get workspace with id: {}", id)
}

async fn update_workspace(Path(id): Path<String>) -> impl IntoResponse {
    format!("Update workspace with id: {}", id)
}

async fn delete_workspace(Path(id): Path<String>) -> impl IntoResponse {
    format!("Delete workspace with id: {}", id)
}

#[tokio::main]
async fn main() {
    lib::workspaces::ensure_workspace();

    let app = Router::new()
        .route("/", get(|| async { "Hello, world!" }))
        .route(
            "/api/workspaces",
            get(list_workspaces).post(create_workspace),
        )
        .route(
            "/api/workspaces/:id",
            get(get_workspace)
                .put(update_workspace)
                .delete(delete_workspace),
        );

    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    println!("Listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    serve(listener, app).await.unwrap();
}

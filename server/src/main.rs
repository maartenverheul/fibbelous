use axum::extract::Path;
use axum::routing::post;
use axum::{response::IntoResponse, routing::get, serve, Json, Router};
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

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

// Simple hello endpoint for connection testing
async fn hello() -> impl IntoResponse {
    println!("Received hello request");
    (axum::http::StatusCode::OK, "Hello from server!")
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

async fn remove_workspace(Path(id): Path<String>) -> impl IntoResponse {
    format!("Delete workspace with id: {}", id)
}

async fn make_toc(Path(id): Path<String>) -> impl IntoResponse {
    format!("Make TOC for workspace with id: {}", id)
}

#[tokio::main]
async fn main() {
    lib::workspaces::ensure_workspace();

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/", get(|| async { "Hello, world!" }))
        .route("/api/hello", get(hello))
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
        .layer(cors);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    println!("Listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    serve(listener, app).await.unwrap();
}

use axum::extract::{Path, State};
use axum::routing::post;
use axum::{response::IntoResponse, routing::get, serve, Json, Router};
use lib::tracing::info;
use sea_orm::DatabaseConnection;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

// Placeholder handlers for CRUD endpoints
#[derive(Clone)]
struct AppState {
    db: DatabaseConnection,
}

async fn list_workspaces(State(_state): State<AppState>) -> impl IntoResponse {
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

async fn create_workspace(State(state): State<AppState>) -> impl IntoResponse {
    // if let Err(e) = lib::indexing::set_setting(&state.db, "last_action", "create_workspace").await {
    //     return (
    //         axum::http::StatusCode::INTERNAL_SERVER_ERROR,
    //         format!("DB error: {}", e),
    //     )
    //         .into_response();
    // }
    (
        axum::http::StatusCode::CREATED,
        "Workspace created (placeholder)",
    )
        .into_response()
}

async fn get_workspace(State(state): State<AppState>, Path(id): Path<String>) -> impl IntoResponse {
    // let last = lib::indexing::get_setting(&state.db, "last_action")
    //     .await
    //     .ok()
    //     .flatten();
    // Json(serde_json::json!({
    //     "id": id,
    //     "lastAction": last,
    // }))
    // .into_response()
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
    // Initialize logging to ./.data/logs
    let data_dir = std::path::PathBuf::from(".data");
    let logs_dir = data_dir.join("logs");
    lib::logging::init(logs_dir.as_path());

    lib::workspaces::ensure_workspace();

    // Open shared index database in ./.data/index.sqlite
    let db = lib::indexing::init_index_db(&data_dir)
        .await
        .expect("Failed to open index database in .data");

    let state = AppState { db };

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
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    info!("Listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    serve(listener, app).await.unwrap();
}

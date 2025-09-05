use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Path, State, WebSocketUpgrade};
use axum::routing::post;
use axum::{response::IntoResponse, routing::get, serve, Json, Router};
use futures_util::StreamExt;
use lib::tracing::{debug_span, info};
use sea_orm::DatabaseConnection;
use std::collections::HashMap;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};

// Placeholder handlers for CRUD endpoints
#[derive(Clone)]
struct WorkspaceState {
    id: String,
    path: std::path::PathBuf,
    info: lib::workspaces::WorkspaceInfo,
    db: DatabaseConnection,
}

#[derive(Clone)]
struct AppState {
    workspaces: HashMap<String, WorkspaceState>,
}

async fn list_workspaces(State(state): State<AppState>) -> impl IntoResponse {
    let list: Vec<lib::workspaces::WorkspaceInfo> =
        state.workspaces.values().map(|w| w.info.clone()).collect();
    Json(list).into_response()
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

    info!(target: "main", "==============");
    info!(target: "main", "SERVER STARTED");

    lib::workspaces::ensure_workspace();
    let state = init_app_state().await;
    let app = build_app(state);
    start_server(app).await;
}

async fn init_workspaces() -> HashMap<String, WorkspaceState> {
    info!(target: "main", "Initializing workspaces");
    let dirs = lib::workspaces::workspace_dirs().unwrap_or_default();
    let infos_vec = lib::workspaces::list().unwrap_or_default();
    let info_map: HashMap<String, lib::workspaces::WorkspaceInfo> =
        infos_vec.into_iter().map(|i| (i.id.clone(), i)).collect();

    let mut workspaces: HashMap<String, WorkspaceState> = HashMap::new();
    info!(target: "main", "Found {} workspace directories", dirs.len());
    for dir in dirs {
        info!(target: "main", "Initializing workspace at: {:?}", dir);
        if let Some(os_id) = dir.file_name() {
            let id = os_id.to_string_lossy().to_string();
            let info = match info_map.get(&id) {
                Some(i) => i.clone(),
                None => continue,
            };
            let fib = dir.join(".fibbelous");
            let db = lib::indexing::init_index_db(&fib)
                .await
                .unwrap_or_else(|e| panic!("Failed to init DB for workspace {}: {}", id, e));
            workspaces.insert(
                id.clone(),
                WorkspaceState {
                    id,
                    path: dir.clone(),
                    info,
                    db,
                },
            );
        }
    }

    workspaces
}

async fn init_app_state() -> AppState {
    // Load workspace infos and initialize a DB per workspace in <workspace_root>/.fibbelous
    let workspaces = init_workspaces().await;

    AppState { workspaces }
}

fn build_app(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/", get(|| async { "Hello, world!" }))
        .route("/api/hello", get(hello))
        // WebSocket endpoint for real-time events / messages
        .route("/ws", get(ws_handler))
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

// Basic websocket handler that echoes messages and sends a greeting.
async fn ws_handler(ws: WebSocketUpgrade, State(_state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    debug_span!(target: "ws", "New WebSocket connection established");

    // Send initial greeting
    if socket
        .send(Message::Text("Welcome to Fibbelous WS".into()))
        .await
        .is_err()
    {
        return;
    }

    while let Some(Ok(msg)) = socket.next().await {
        match msg {
            Message::Text(t) => {
                // Simple echo with prefix
                if socket
                    .send(Message::Text(format!("echo: {}", t)))
                    .await
                    .is_err()
                {
                    break;
                }
            }
            Message::Binary(bin) => {
                if socket.send(Message::Binary(bin)).await.is_err() {
                    break;
                }
            }
            Message::Close(_) => {
                let _ = socket.send(Message::Close(None)).await; // Attempt polite close
                break;
            }
            Message::Ping(p) => {
                if socket.send(Message::Pong(p)).await.is_err() {
                    break;
                }
            }
            Message::Pong(_) => { /* ignore */ }
        }
    }
}

async fn start_server(app: Router) {
    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    info!("Listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    serve(listener, app).await.unwrap();
}

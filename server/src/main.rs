use argh::FromArgs;
use axum::{serve, Router};
use lib::tracing::{debug, info};
use sea_orm::DatabaseConnection;
use std::collections::HashMap;
use std::net::SocketAddr;

mod routes;
mod ws;

// Placeholder handlers for CRUD endpoints
#[derive(Clone)]
pub(crate) struct WorkspaceState {
    id: String,
    path: std::path::PathBuf,
    info: lib::workspaces::WorkspaceInfo,
    db: DatabaseConnection,
}

#[derive(Clone)]
pub(crate) struct AppState {
    workspaces: HashMap<String, WorkspaceState>,
}

#[derive(FromArgs, Debug)]
/// Fibbelous server
struct Cli {
    /// enable verbose logging
    #[argh(switch)]
    verbose: bool,
}

#[tokio::main]
async fn main() {
    let cli: Cli = argh::from_env();
    // Initialize logging to ./.data/logs
    let data_dir = std::path::PathBuf::from(".data");
    let logs_dir = data_dir.join("logs");
    // Flag parsing precedence: CLI flag overrides env var VERBOSE if set
    let env_verbose = std::env::var("VERBOSE")
        .ok()
        .map(|v| v.to_lowercase())
        .map(|v| matches!(v.as_str(), "1" | "true" | "yes" | "on"))
        .unwrap_or(false);
    let verbose = if cli.verbose { true } else { env_verbose };
    lib::logging::init(logs_dir.as_path(), verbose);

    info!("==============");
    info!("SERVER STARTED");
    if verbose {
        debug!("Verbose logging enabled");
    }

    lib::workspaces::ensure_workspace();
    let state = init_app_state().await;
    let router = routes::build_router(state);
    start_server(router).await;
}

async fn init_workspaces() -> HashMap<String, WorkspaceState> {
    info!("Initializing workspaces");
    let dirs = lib::workspaces::workspace_dirs().unwrap_or_default();
    let infos_vec = lib::workspaces::list().unwrap_or_default();
    let info_map: HashMap<String, lib::workspaces::WorkspaceInfo> =
        infos_vec.into_iter().map(|i| (i.id.clone(), i)).collect();

    let mut workspaces: HashMap<String, WorkspaceState> = HashMap::new();
    info!("Found {} workspace directories", dirs.len());
    for dir in dirs {
        info!("Initializing workspace at: {:?}", dir);
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

async fn start_server(app: Router) {
    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    info!("Listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    serve(listener, app).await.unwrap();
}

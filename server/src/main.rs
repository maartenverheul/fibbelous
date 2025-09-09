use argh::FromArgs;
use axum::{serve, Router};
use lib::command_handler::CommandEnv;
use lib::state::{AppState, WorkspaceState};
use lib::tracing::{debug, info};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;

mod routes;
mod ws;

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

    let state = init_app_state().await;
    let router = routes::build_router(state);
    start_server(router).await;
}

async fn init_app_state() -> AppState {
    let loaded = lib::workspaces::load_all_workspaces().await;
    let mut workspaces: HashMap<String, WorkspaceState> = HashMap::new();
    for w in loaded {
        workspaces.insert(
            w.id.clone(),
            WorkspaceState {
                id: w.id,
                path: w.path,
                info: w.info,
                db: w.db,
            },
        );
    }
    let env = CommandEnv::new(
        workspaces.values().map(|w| w.info.clone()).collect(),
        vec![],
    );
    AppState {
        workspaces: Arc::new(RwLock::new(workspaces)),
        env: Arc::new(RwLock::new(env)),
    }
}

async fn start_server(app: Router) {
    let addr = SocketAddr::from(([127, 0, 0, 1], 3001));
    info!("Listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    serve(listener, app).await.unwrap();
}

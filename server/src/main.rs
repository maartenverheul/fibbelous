use argh::FromArgs;
use axum::serve;
use fib_core::state::{init_app_state, AppState};
use fib_core::tracing::{debug, info};
use std::net::SocketAddr;

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
    fib_core::logging::init(logs_dir.as_path(), verbose);

    info!("==============");
    info!("SERVER STARTED");
    if verbose {
        debug!("Verbose logging enabled");
    }

    let state = init_app_state().await;
    start_server(state).await;
}

// init_app_state moved to core::state::init_app_state

async fn start_server(state: AppState) {
    let router = routes::build_router(state);
    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    info!("Listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    serve(listener, router).await.unwrap();
}

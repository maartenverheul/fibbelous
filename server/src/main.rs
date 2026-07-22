use std::path::Path;
use std::sync::{Arc, RwLock};

use tracing::Level;
use tracing_subscriber::{EnvFilter, fmt, prelude::*};

use server::config::Config;
use server::data::{ensure_workspaces_dir, log_path};
use server::http::run_server;
use server::workspace::{discover_workspaces, start_indexing};

fn init_tracing() {
    let env_path = Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    dotenvy::from_path(&env_path).ok();
    dotenvy::dotenv().ok();

    let filter = EnvFilter::builder()
        .with_default_directive(Level::INFO.into())
        .from_env_lossy();

    tracing_subscriber::registry()
        .with(fmt::layer().with_writer(std::io::stdout))
        .with(filter)
        .init();
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    init_tracing();

    let workspaces_dir = ensure_workspaces_dir()?;
    tracing::info!(path = %log_path(&workspaces_dir), "workspaces directory ready");

    let workspaces = Arc::new(RwLock::new(discover_workspaces(&workspaces_dir)?));
    tracing::info!(
        count = workspaces.read().expect("workspaces lock poisoned").len(),
        "workspaces discovered"
    );

    start_indexing(
        &workspaces
            .read()
            .expect("workspaces lock poisoned"),
    );

    let config = Config::from_env();
    let server_addr = config.server_addr().parse()?;

    tracing::info!(%server_addr, "starting http and websocket server");

    let handle = run_server(
        server_addr,
        Arc::clone(&workspaces),
        workspaces_dir.clone(),
    )
    .await?;

    tracing::info!(
        %server_addr,
        "server ready (GET/POST /workspaces, POST /workspaces/open, ws://{server_addr}/{{workspaceId}})"
    );

    tokio::signal::ctrl_c().await?;
    tracing::info!("shutting down");
    handle.stop()?;
    handle.stopped().await;

    Ok(())
}

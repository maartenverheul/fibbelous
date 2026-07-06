mod cache;
mod config;
mod data;
mod index;
mod rpc;
mod workspace;

use std::path::Path;
use std::sync::Arc;

use jsonrpsee::server::ServerBuilder;
use tracing::Level;
use tracing_subscriber::{EnvFilter, fmt, prelude::*};

use crate::config::Config;
use crate::data::{ensure_workspaces_dir, log_path};
use crate::rpc::{RpcState, build_module};
use crate::workspace::{discover_workspaces, start_indexing};

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

    let workspaces = Arc::new(discover_workspaces(&workspaces_dir)?);
    tracing::info!(count = workspaces.len(), "workspaces discovered");

    start_indexing(Arc::clone(&workspaces));

    let config = Config::from_env();
    let rpc_module = build_module(RpcState { workspaces });
    let server_addr = config.server_addr();

    tracing::info!(%server_addr, "starting json-rpc websocket server");

    let server = ServerBuilder::default().build(&server_addr).await?;
    let handle = server.start(rpc_module);

    tracing::info!(%server_addr, "server ready (connect via ws://{server_addr})");

    tokio::signal::ctrl_c().await?;
    tracing::info!("shutting down");
    handle.stop()?;
    handle.stopped().await;

    Ok(())
}

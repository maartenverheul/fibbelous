use std::path::Path;

use tracing::Level;
use tracing_subscriber::{EnvFilter, fmt, prelude::*};

/// Initialize tracing with the same defaults as the HTTP server binary.
///
/// Loads `server/.env` then the process `.env`, then installs a stdout
/// subscriber filtered by `RUST_LOG` (default INFO). Safe to call once at
/// process startup from either the server binary or the Tauri app.
pub fn init_tracing() {
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

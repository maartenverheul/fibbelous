use std::path::Path;

use rusqlite::{params, Connection, Result};
use tracing::{debug, error, info};

/// Name of the app database file within a workspace directory
pub const DB_FILE: &str = "index.sqlite";

/// Open (and create if missing) the workspace SQLite database at `<workspace_root>/databases/app.sqlite`.
/// Ensures the base schema exists.
pub fn init_index_db(location: &Path) -> Result<Connection> {
    let db_path = location.join(DB_FILE);
    info!("Initializing index database at {:?}", db_path);
    if let Some(parent) = db_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            error!("Failed to create parent directory {:?}: {}", parent, e);
            return Err(rusqlite::Error::ToSqlConversionFailure(Box::new(e)));
        }
    }
    let conn = Connection::open(&db_path)?;
    debug!("Opened SQLite connection");
    init_schema(&conn)?;
    info!("Database schema initialized");
    Ok(conn)
}

/// Create minimal schema if not present.
fn init_schema(conn: &Connection) -> Result<()> {
    // Simple key-value store for app settings
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);",
        [],
    )?;

    // Example table for indexed documents
    conn.execute(
        "CREATE TABLE IF NOT EXISTS documents (
			id TEXT PRIMARY KEY,
			path TEXT NOT NULL,
			title TEXT,
			updated_at INTEGER NOT NULL
		);",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);",
        [],
    )?;

    // Simple migration meta
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at INTEGER NOT NULL
		);",
        [],
    )?;

    Ok(())
}

/// Tiny smoke test helper: set and get a setting value.
pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings(key, value) VALUES (?1, ?2)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
        params![key, value],
    )?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        let v: String = row.get(0)?;
        Ok(Some(v))
    } else {
        Ok(None)
    }
}

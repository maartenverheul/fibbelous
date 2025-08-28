use lib::workspaces::{WorkspaceConnection, WorkspaceInfo};
use serde_json;
use std::env;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;
use tracing::{debug, error, info, warn};

/// Shared in-memory application state for connections and resolved workspaces
pub struct AppState {
    pub connections: Mutex<Vec<WorkspaceConnection>>,
    pub workspaces: Mutex<Vec<WorkspaceInfo>>, // resolved workspaces
}

pub struct ConnectionManager;

impl ConnectionManager {
    /// Returns the path to the app's persistent data folder, creating it if necessary.
    /// Uses Tauri's app-specific data directory with a temp fallback.
    pub fn app_data_dir(app: &AppHandle) -> std::io::Result<PathBuf> {
        let dir = app
            .path_resolver()
            .app_data_dir()
            .or_else(|| {
                let mut tmp = env::temp_dir();
                tmp.push("fibbelous_app_data");
                Some(tmp)
            })
            .expect("failed to resolve app data dir");

        if !dir.exists() {
            info!(target: "fibbelous", "Creating app data folder at: {}", dir.display());
            std::fs::create_dir_all(&dir)?;
        } else {
            debug!(target: "fibbelous", "App data folder: {}", dir.display());
        }
        Ok(dir)
    }

    /// Returns the full path to the connections.json file
    pub fn connections_file_path(app: &AppHandle) -> std::io::Result<PathBuf> {
        Ok(Self::app_data_dir(app)?.join("connections.json"))
    }

    /// Load saved WorkspaceConnection list from the connections.json file.
    pub fn load_saved_connections(app: &AppHandle) -> Vec<WorkspaceConnection> {
        let path = match Self::connections_file_path(app) {
            Ok(p) => p,
            Err(err) => {
                error!(target: "fibbelous", "Failed to compute connections file path: {}", err);
                return Vec::new();
            }
        };
        if !path.exists() {
            info!(target: "fibbelous", "No existing connections file at {}", path.display());
            return Vec::new();
        }
        match std::fs::read_to_string(&path) {
            Ok(data) => match serde_json::from_str::<Vec<WorkspaceConnection>>(&data) {
                Ok(list) => {
                    info!(target: "fibbelous", "Loaded {} saved connection(s)", list.len());
                    list
                }
                Err(err) => {
                    warn!(target: "fibbelous", "Failed parsing {}: {}", path.display(), err);
                    Vec::new()
                }
            },
            Err(err) => {
                warn!(target: "fibbelous", "Failed reading {}: {}", path.display(), err);
                Vec::new()
            }
        }
    }

    /// Saves a WorkspaceConnection to a JSON file in the app data folder.
    /// Returns true if the file was updated, false if the connection already existed.
    pub fn save_connection_info(
        app: &AppHandle,
        connection: &WorkspaceConnection,
    ) -> std::io::Result<bool> {
        let dir = Self::app_data_dir(app)?;
        let file_path = dir.join("connections.json");
        let mut connections: Vec<WorkspaceConnection> = if file_path.exists() {
            let data = std::fs::read_to_string(&file_path)?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Vec::new()
        };
        // Only add if not already present (by id)
        if connections.iter().any(|c| c.id == connection.id) {
            info!(target: "fibbelous", "Connection_info with id {} already exists, skipping save", connection.id);
            return Ok(false);
        }
        info!(target: "fibbelous", "Adding new connection_info with id: {}", connection.id);
        connections.push(connection.clone());
        let json = serde_json::to_string_pretty(&connections)?;
        let mut file = std::fs::File::create(&file_path)?;
        file.write_all(json.as_bytes())?;
        info!(target: "fibbelous", "Saved {} connection(s)", connections.len());
        Ok(true)
    }

    pub fn resolve_workspace_from_path(path: &Path) -> Option<WorkspaceInfo> {
        let json_path = path.join("workspace.json");
        let data = std::fs::read_to_string(&json_path).ok()?;
        serde_json::from_str::<WorkspaceInfo>(&data).ok()
    }

    pub fn resolve_workspace_from_url(url: &str) -> Option<WorkspaceInfo> {
        // Expecting base/api/<workspace-slug> returning WorkspaceInfo JSON
        let resp = reqwest::blocking::get(url).ok()?;
        if !resp.status().is_success() {
            warn!(target: "fibbelous", "HTTP {} fetching {}", resp.status(), url);
            return None;
        }
        resp.json::<WorkspaceInfo>().ok()
    }

    pub fn compute_workspaces_from_connections(
        conns: &[WorkspaceConnection],
    ) -> Vec<WorkspaceInfo> {
        let mut out = Vec::new();
        for c in conns {
            if let Some(p) = &c.path {
                let path = Path::new(p);
                if let Some(ws) = Self::resolve_workspace_from_path(path) {
                    out.push(ws);
                    continue;
                }
            }
            if let Some(url) = &c.url {
                if let Some(ws) = Self::resolve_workspace_from_url(url) {
                    out.push(ws);
                }
            }
        }
        out
    }

    /// Delete a connection by id from connections.json. Returns true if removed.
    pub fn delete_connection(app: &AppHandle, id: &str) -> std::io::Result<bool> {
        let dir = Self::app_data_dir(app)?;
        let file_path = dir.join("connections.json");
        let mut connections: Vec<WorkspaceConnection> = if file_path.exists() {
            let data = std::fs::read_to_string(&file_path)?;
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            Vec::new()
        };
        let before = connections.len();
        connections.retain(|c| c.id != id);
        if connections.len() == before {
            warn!(target: "fibbelous", "delete_connection: id {} not found", id);
            return Ok(false);
        }
        let json = serde_json::to_string_pretty(&connections)?;
        let mut file = std::fs::File::create(&file_path)?;
        file.write_all(json.as_bytes())?;
        info!(target: "fibbelous", "Deleted connection {}. Remaining: {}", id, connections.len());
        Ok(true)
    }
}

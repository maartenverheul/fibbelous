use core::pages::Page;
use core::tracing::{debug, error, info, warn};
use core::workspaces::{WorkspaceConnection, WorkspaceInfo};
use serde_json;
use std::env;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::AppHandle;

/// Shared in-memory application state for connections and resolved workspaces
pub struct AppState {
    pub connections: Mutex<Vec<WorkspaceConnection>>,
    pub active_workspace: Mutex<Option<WorkspaceInfo>>,
    pub workspaces: Mutex<Vec<WorkspaceInfo>>, // resolved workspaces
    pub pages: Mutex<Vec<Page>>,               // loaded pages from active workspace
}

pub struct ConnectionManager;

impl ConnectionManager {
    /// Returns the path to the app's persistent data folder, creating it if necessary.
    /// Uses Tauri's app-specific data directory with a temp fallback.
    pub fn app_data_dir(app: &AppHandle) -> std::io::Result<PathBuf> {
        let dir = app.path_resolver().app_data_dir().unwrap_or_else(|| {
            let mut tmp = env::temp_dir();
            tmp.push("fibbelous_app_data");
            tmp
        });
        if !dir.exists() {
            info!(target: "connections", "Creating app data folder at: {}", dir.display());
            std::fs::create_dir_all(&dir)?;
        } else {
            debug!(target: "connections", "App data folder: {}", dir.display());
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
                error!(target: "connections", "Failed to compute connections file path: {}", err);
                return Vec::new();
            }
        };
        if !path.exists() {
            info!(target: "connections", "No existing connections file at {}", path.display());
            return Vec::new();
        }
        let data = match std::fs::read_to_string(&path) {
            Ok(data) => data,
            Err(err) => {
                error!(target: "connections", "Failed reading {}: {}", path.display(), err);
                return Vec::new();
            }
        };
        let list = match serde_json::from_str::<Vec<WorkspaceConnection>>(&data) {
            Ok(list) => list,
            Err(err) => {
                error!(target: "connections", "Failed parsing {}: {}", path.display(), err);
                return Vec::new();
            }
        };
        let kept = Self::prune_missing_local_paths(&path, list);
        info!(target: "connections", "Found {} saved connection(s)", kept.len());
        kept
    }

    /// Remove connections whose local `path` no longer exists. If anything is removed,
    /// rewrite the `connections.json` file with the pruned list.
    fn prune_missing_local_paths(
        connections_file: &Path,
        list: Vec<WorkspaceConnection>,
    ) -> Vec<WorkspaceConnection> {
        let (kept, removed): (Vec<WorkspaceConnection>, Vec<WorkspaceConnection>) = list
            .into_iter()
            .partition(|c| c.path.as_ref().map_or(true, |p| Path::new(p).exists()));

        if removed.is_empty() {
            return kept;
        }

        // Try to update the file with the pruned list
        if let Ok(json) = serde_json::to_string_pretty(&kept) {
            match std::fs::File::create(connections_file)
                .and_then(|mut file| file.write_all(json.as_bytes()))
            {
                Ok(_) => info!(
                    target: "connections",
                    "Pruned {} connection(s) with missing path; kept {}",
                    removed.len(),
                    kept.len()
                ),
                Err(e) => error!(
                    target: "connections",
                    "Failed to update {} after pruning: {}",
                    connections_file.display(),
                    e
                ),
            }
        } else {
            error!(target: "connections", "Failed to serialize pruned connections");
        }

        kept
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
            std::fs::read_to_string(&file_path)
                .ok()
                .and_then(|data| serde_json::from_str(&data).ok())
                .unwrap_or_default()
        } else {
            Vec::new()
        };
        if connections.iter().any(|c| c.id == connection.id) {
            info!(target: "connections", "Connection_info with id {} already exists, skipping save", connection.id);
            return Ok(false);
        }
        info!(target: "connections", "Adding new connection_info with id: {}", connection.id);
        connections.push(connection.clone());
        let json = serde_json::to_string_pretty(&connections)?;
        let mut file = std::fs::File::create(&file_path)?;
        file.write_all(json.as_bytes())?;
        info!(target: "connections", "Saved {} connection(s)", connections.len());
        Ok(true)
    }

    pub fn resolve_workspace_from_path(path: &Path) -> Option<WorkspaceInfo> {
        let json_path = path.join("workspace.json");
        debug!(target: "connections", "Parsing workspace from path: {}", json_path.display());
        let data = match std::fs::read_to_string(&json_path) {
            Ok(data) => data,
            Err(e) => {
                debug!(target: "connections", "Failed reading {}: {}", json_path.display(), e);
                return None;
            }
        };
        match serde_json::from_str::<WorkspaceInfo>(&data) {
            Ok(ws) => {
                info!(target: "connections", "Loaded workspace: {}", ws.slug);
                Some(ws)
            }
            Err(e) => {
                error!(target: "connections", "Failed to parse workspace JSON at {}: {}", json_path.display(), e);
                None
            }
        }
    }

    pub fn resolve_workspace_from_url(url: &str) -> Option<WorkspaceInfo> {
        // Expecting base/api/<workspace-slug> returning WorkspaceInfo JSON
        debug!(target: "connections", "Fetching workspace from URL: {}", url);
        let resp = match reqwest::blocking::get(url) {
            Ok(r) => r,
            Err(e) => {
                warn!(target: "connections", "Request error fetching {}: {}", url, e);
                return None;
            }
        };
        if !resp.status().is_success() {
            warn!(target: "connections", "HTTP {} fetching {}", resp.status(), url);
            return None;
        }
        let ws = match resp.json::<WorkspaceInfo>() {
            Ok(ws) => ws,
            Err(e) => {
                error!(target: "connections", "Failed parsing response from {}: {}", url, e);
                return None;
            }
        };
        info!(target: "connections", "Parsed workspace from URL: {}", url);
        Some(ws)
    }

    pub fn compute_workspaces_from_connections(
        conns: &[WorkspaceConnection],
    ) -> Vec<WorkspaceInfo> {
        conns.iter().filter_map(|c| {
            if let Some(p) = &c.path {
                let path = Path::new(p);
                debug!(target: "connections", "Trying local path for connection {}: {}", c.id, path.display());
                if let Some(ws) = Self::resolve_workspace_from_path(path) {
                    return Some(ws);
                }
                debug!(target: "connections", "No valid workspace at local path for connection {}", c.id);
            }
            if let Some(url) = &c.url {
                debug!(target: "connections", "Trying URL for connection {}: {}", c.id, url);
                if let Some(ws) = Self::resolve_workspace_from_url(url) {
                    return Some(ws);
                }
                error!(target: "connections", "Failed to resolve workspace from URL for connection {}", c.id);
            }
            None
        }).collect()
    }

    /// Delete a connection by id from connections.json. Returns true if removed.
    pub fn remove_connection(app: &AppHandle, id: &str) -> std::io::Result<bool> {
        let dir = Self::app_data_dir(app)?;
        let file_path = dir.join("connections.json");
        let mut connections: Vec<WorkspaceConnection> = if file_path.exists() {
            std::fs::read_to_string(&file_path)
                .ok()
                .and_then(|data| serde_json::from_str(&data).ok())
                .unwrap_or_default()
        } else {
            Vec::new()
        };
        let before = connections.len();
        connections.retain(|c| c.id != id);
        if connections.len() == before {
            warn!(target: "connections", "remove_connection: id {} not found", id);
            return Ok(true);
        }
        let json = serde_json::to_string_pretty(&connections)?;
        let mut file = std::fs::File::create(&file_path)?;
        file.write_all(json.as_bytes())?;
        info!(target: "connections", "Removed connection {}. Remaining: {}", id, connections.len());
        Ok(true)
    }
}

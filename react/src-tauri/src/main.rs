// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod connections;

use connections::{AppState, ConnectionManager};
use lib::logging;
use lib::pages::{Page, PageWithContent};
use lib::tracing::{error, info, warn};
use lib::workspaces::{WorkspaceConnection, WorkspaceInfo};
use serde::Serialize;
use serde_json;
use std::fs;
use std::process::Command;
use std::sync::Mutex;
use tauri::api::dialog::blocking::FileDialogBuilder;
use tauri::AppHandle;
use tauri::Manager;
use tauri::State;

#[tauri::command]
fn get_saved_connections(state: State<AppState>) -> Vec<WorkspaceConnection> {
    let guard = state.connections.lock().expect("mutex poisoned");
    guard.clone()
}

#[tauri::command]
fn get_saved_workspaces(state: State<AppState>) -> Vec<WorkspaceInfo> {
    let guard = state.workspaces.lock().expect("mutex poisoned");
    guard.clone()
}

#[derive(Serialize)]
struct AddLocalRepoResponse {
    ok: bool,
    error: Option<String>,
    workspace: Option<WorkspaceInfo>,
}

#[tauri::command]
fn add_local_repository(
    app: AppHandle,
    state: State<AppState>,
    existing: bool,
) -> AddLocalRepoResponse {
    info!(target: "main", "Adding local workspace with existing={}", existing);
    // Show a directory picker dialog
    let selected_dir = FileDialogBuilder::new()
        .set_title("Select a workspace directory")
        .pick_folder();

    let Some(path) = selected_dir else {
        warn!(target: "main", "Operation cancelled or no directory selected");
        return AddLocalRepoResponse {
            ok: false,
            error: None,
            workspace: None,
        };
    };

    // Determine workspace info: either load existing or create a new one in the selected folder
    let info: WorkspaceInfo = if existing {
        info!(target: "main", "Opening workspace at {}", path.display());

        // Check for workspace.json in the selected directory
        let json_path = path.join("workspace.json");
        let Ok(json) = fs::read_to_string(&json_path) else {
            let msg = format!("workspace.json not found at {}", json_path.display());
            warn!(target: "main", "{}", msg);
            return AddLocalRepoResponse {
                ok: false,
                error: Some(msg),
                workspace: None,
            };
        };
        match serde_json::from_str::<WorkspaceInfo>(&json) {
            Ok(ws) => ws,
            Err(_) => {
                let msg = format!("Failed to parse workspace.json at {}", json_path.display());
                warn!(target: "main", "{}", msg);
                return AddLocalRepoResponse {
                    ok: false,
                    error: Some(msg),
                    workspace: None,
                };
            }
        }
    } else {
        // 1) Ensure directory is empty
        match fs::read_dir(&path) {
            Ok(mut rd) => {
                if rd.next().is_some() {
                    let msg =
                        "Selected directory must be empty to create a new workspace".to_string();
                    warn!(target: "main", "{}", msg);
                    return AddLocalRepoResponse {
                        ok: false,
                        error: Some(msg),
                        workspace: None,
                    };
                }
            }
            Err(err) => {
                let msg = format!("Failed to read directory {}: {}", path.display(), err);
                warn!(target: "main", "{}", msg);
                return AddLocalRepoResponse {
                    ok: false,
                    error: Some(msg),
                    workspace: None,
                };
            }
        }

        // 2) Generate new workspace (git repo + standard folders + workspace.json) at the directory
        info!(target: "main", "Creating local workspace at {}", path.display());
        let ws = WorkspaceInfo::default_workspace();
        if let Err(e) = lib::workspaces::create(&ws, Some(&path)) {
            let msg = format!("Failed to create workspace at {}: {}", path.display(), e);
            error!(target: "main", "{}", msg);
            return AddLocalRepoResponse {
                ok: false,
                error: Some(msg),
                workspace: None,
            };
        }

        ws
    };

    // Prevent duplicates: if a connection with same id already exists, skip
    {
        let conns = state.connections.lock().expect("mutex poisoned");
        if conns.iter().any(|c| c.id == info.id) {
            let msg = "Workspace is already loaded".to_string();
            warn!(target: "main", "{}", msg);
            return AddLocalRepoResponse {
                ok: false,
                error: Some(msg),
                workspace: None,
            };
        }
    }

    let connection_info = WorkspaceConnection {
        id: info.id.clone(),
        path: Some(path),
        url: None,
        git: None,
    };

    // Save connection_info to app data folder as JSON
    match ConnectionManager::save_connection_info(&app, &connection_info) {
        Err(err) => {
            let msg = format!("Failed to save connection_info: {}", err);
            error!(target: "main", "{}", msg);
            return AddLocalRepoResponse {
                ok: false,
                error: Some(msg),
                workspace: None,
            };
        }
        Ok(updated) => {
            if updated {
                // Update in-memory connections without duplicating by id
                let mut conns = state.connections.lock().expect("mutex poisoned");
                if !conns.iter().any(|c| c.id == connection_info.id) {
                    conns.push(connection_info.clone());
                }
                drop(conns);

                // Recompute workspaces from current connections
                let conns_snapshot = state.connections.lock().expect("mutex poisoned");
                let new_workspaces =
                    ConnectionManager::compute_workspaces_from_connections(&conns_snapshot);
                drop(conns_snapshot);
                let mut ws = state.workspaces.lock().expect("mutex poisoned");
                *ws = new_workspaces;
                // If no active workspace set, or the active one no longer exists, pick the first
                {
                    let mut active = state.active_workspace.lock().expect("mutex poisoned");
                    if active
                        .as_ref()
                        .map(|a| !ws.iter().any(|w| w.id == a.id))
                        .unwrap_or(true)
                    {
                        *active = ws.first().cloned();
                    }
                }
            }
        }
    }

    AddLocalRepoResponse {
        ok: true,
        error: None,
        workspace: Some(info),
    }
}

#[tauri::command]
fn open_workspace_in_system(state: State<AppState>, id: String) -> Result<(), String> {
    let connections = state
        .connections
        .lock()
        .map_err(|_| "mutex poisoned".to_string())?;
    let connection = connections
        .iter()
        .find(|c| c.id == id)
        .ok_or_else(|| "Workspace not found".to_string())?;
    let path = connection
        .path
        .as_ref()
        .ok_or_else(|| "Workspace has no path".to_string())?;

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer").arg(path).status();
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(path).status();
    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open").arg(path).status();

    match result {
        Ok(status) if status.success() => Ok(()),
        Ok(status) => Err(format!("Failed to open explorer, exit code: {}", status)),
        Err(e) => Err(format!("Failed to open explorer: {}", e)),
    }
}

#[tauri::command]
fn remove_workspace(app: AppHandle, state: State<AppState>, id: String) -> bool {
    match ConnectionManager::remove_connection(&app, &id) {
        Err(err) => {
            error!(target: "main", "Failed to remove connection {}: {}", id, err);
            false
        }
        Ok(updated) => {
            if !updated {
                return false;
            }
            // Update in-memory connections and workspaces
            {
                let mut conns = state.connections.lock().expect("mutex poisoned");
                conns.retain(|c| c.id != id);
            }
            let conns_snapshot = state.connections.lock().expect("mutex poisoned");
            let new_workspaces =
                ConnectionManager::compute_workspaces_from_connections(&conns_snapshot);
            drop(conns_snapshot);
            let mut ws = state.workspaces.lock().expect("mutex poisoned");
            *ws = new_workspaces;
            // If active removed or not set, pick first workspace as active
            {
                let mut active = state.active_workspace.lock().expect("mutex poisoned");
                if active
                    .as_ref()
                    .map(|a| !ws.iter().any(|w| w.id == a.id))
                    .unwrap_or(true)
                {
                    *active = ws.first().cloned();
                }
            }
            true
        }
    }
}
#[tauri::command]
fn create_new_page(
    _app: AppHandle,
    state: State<AppState>,
    parent: Option<String>,
) -> Result<Page, String> {
    let maybe_workspace = state
        .active_workspace
        .lock()
        .map_err(|_| "mutex poisoned".to_string())?;

    if let Some(workspace) = maybe_workspace.as_ref() {
        let mut pages = state
            .pages
            .lock()
            .map_err(|_| "mutex poisoned".to_string())?;
        let page = Page::default(parent);
        pages.push(page.clone());

        // Find the connection for the active workspace
        let connections = state
            .connections
            .lock()
            .map_err(|_| "mutex poisoned".to_string())?;
        let connection = connections
            .iter()
            .find(|c| c.id == workspace.id)
            .ok_or("Active workspace connection not found".to_string())?;

        let workspace_path = std::path::Path::new(
            connection
                .path
                .as_ref()
                .ok_or("Active workspace connection has no path".to_string())?,
        );
        let _ = lib::pages::save_page(workspace_path, &page);
        Ok(page)
    } else {
        Err("No active workspace: cannot create a new page".to_string())
    }
}

#[tauri::command]
fn read_page(
    _app: AppHandle,
    state: State<AppState>,
    workspace_id: String,
    page_id: String,
) -> Result<PageWithContent, String> {
    // Find the connection for the given workspace_id
    let connections = state
        .connections
        .lock()
        .map_err(|_| "mutex poisoned".to_string())?;
    let connection = connections
        .iter()
        .find(|c| c.id == workspace_id)
        .ok_or("Workspace connection not found".to_string())?;

    lib::pages::read_page(&connection, &page_id)
}

#[tauri::command]
fn save_remote_workspaces(
    app: AppHandle,
    state: State<AppState>,
    urls: Vec<String>,
) -> Result<(), String> {
    info!(target: "main", "Saving {} remote workspace URL(s)", urls.len());

    let mut any_saved = false;

    for url in urls.into_iter() {
        if url.trim().is_empty() {
            continue;
        }
        match ConnectionManager::resolve_workspace_from_url(&url) {
            Some(ws) => {
                let conn = WorkspaceConnection {
                    id: ws.id.clone(),
                    path: None,
                    url: Some(url.clone()),
                    git: None,
                };
                match ConnectionManager::save_connection_info(&app, &conn) {
                    Ok(updated) => {
                        if updated {
                            // Update in-memory connections without duplicating by id
                            let mut conns = state.connections.lock().expect("mutex poisoned");
                            if !conns.iter().any(|c| c.id == conn.id) {
                                conns.push(conn);
                            }
                            any_saved = true;
                        } else {
                            info!(target: "main", "Connection for workspace {} already exists, skipping", ws.id);
                        }
                    }
                    Err(e) => {
                        error!(target: "main", "Failed to save remote connection: {}", e);
                    }
                }
            }
            None => {
                warn!(target: "main", "Could not resolve workspace from URL: {}", url);
            }
        }
    }

    // Recompute and update workspaces if anything changed
    if any_saved {
        let conns_snapshot = state.connections.lock().expect("mutex poisoned");
        let new_workspaces =
            ConnectionManager::compute_workspaces_from_connections(&conns_snapshot);
        drop(conns_snapshot);
        let mut ws = state.workspaces.lock().expect("mutex poisoned");
        *ws = new_workspaces;
        // Ensure active workspace is valid; set to first when missing/invalid
        {
            let mut active = state.active_workspace.lock().expect("mutex poisoned");
            if active
                .as_ref()
                .map(|a| !ws.iter().any(|w| w.id == a.id))
                .unwrap_or(true)
            {
                *active = ws.first().cloned();
            }
        }
    }

    Ok(())
}

fn main() {
    let context = tauri::generate_context!();
    let builder = tauri::Builder::default()
        .setup(|app| {
            // Initialize logging
            let log_dir = app
                .path_resolver()
                .app_log_dir()
                .or_else(|| app.path_resolver().app_data_dir())
                .unwrap_or_else(|| std::env::temp_dir().join("fibbelous_logs"));

            let app_data_dir = app
                .path_resolver()
                .app_data_dir()
                .unwrap_or_else(|| std::env::temp_dir().join("fibbelous_data"));

            let verbose = std::env::var("VERBOSE")
                .ok()
                .map(|v| v.to_lowercase())
                .map(|v| matches!(v.as_str(), "1" | "true" | "yes" | "on"))
                .unwrap_or(false);
            logging::init(&log_dir, verbose);

            info!(target: "main", "===========");
            info!(target: "main", "APP STARTED");

            info!(target: "main", "App storage is at {}", app_data_dir.display());

            // Load connections into memory on startup
            let initial_conns = ConnectionManager::load_saved_connections(&app.handle());
            let initial_workspaces =
                ConnectionManager::compute_workspaces_from_connections(&initial_conns);
            let initial_active = initial_workspaces.first().cloned();
            app.manage(AppState {
                connections: Mutex::new(initial_conns),
                workspaces: Mutex::new(initial_workspaces),
                active_workspace: Mutex::new(initial_active),
                pages: Mutex::new(Vec::new()),
            });
            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                info!(
                    target: "main",
                    "Window '{}' close requested",
                    event.window().label()
                );
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_saved_workspaces,
            add_local_repository,
            get_saved_connections,
            remove_workspace,
            create_new_page,
            read_page,
            open_workspace_in_system,
            save_remote_workspaces,
        ]);

    let app = builder
        .build(context)
        .expect("error while running tauri application");

    app.run(|_app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } => {
            info!(target: "main", "App exit requested");
        }
        tauri::RunEvent::Exit => {
            info!(target: "main", "Bye!");
            info!(target: "main", "===========");
        }
        _ => {}
    });
}

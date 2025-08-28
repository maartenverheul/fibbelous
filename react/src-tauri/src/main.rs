// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod connections;

use connections::{AppState, ConnectionManager};
use lib::logging;
use lib::tracing::{error, info, warn};
use lib::workspaces::{WorkspaceConnection, WorkspaceInfo};
use serde::Serialize;
use serde_json;
use std::fs;
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
    info!(target: "main", "add_local_repository called with existing={}", existing);
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
        info!(target: "main", "Opening workspace from directory: {}", path.display());

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
        path: Some(path.to_string_lossy().into()),
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
fn delete_workspace(app: AppHandle, state: State<AppState>, id: String) -> bool {
    match ConnectionManager::remove_connection(&app, &id) {
        Err(err) => {
            error!(target: "main", "Failed to delete connection {}: {}", id, err);
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
            true
        }
    }
}

// Resolution helpers moved into `connections` module

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

            logging::init(&log_dir);

            info!(target: "main", "===========");
            info!(target: "main", "APP STARTED");

            info!(target: "main", "App storage is at {}", app_data_dir.display());

            // Load connections into memory on startup
            let initial_conns = ConnectionManager::load_saved_connections(&app.handle());
            let initial_workspaces =
                ConnectionManager::compute_workspaces_from_connections(&initial_conns);
            app.manage(AppState {
                connections: Mutex::new(initial_conns),
                workspaces: Mutex::new(initial_workspaces),
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
            delete_workspace
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

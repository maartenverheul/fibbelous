// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use lib::workspaces::{WorkspaceConnection, WorkspaceInfo};
use serde::Serialize;
use serde_json;
use std::fs;
use std::sync::Mutex;
use tauri::api::dialog::blocking::FileDialogBuilder;
use tauri::AppHandle;
use tauri::Manager;
use tauri::State;
mod connections;
use connections::{AppState, ConnectionManager};

// Connection persistence and resolution lives in the `connections` module

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
struct OpenLocalRepoResponse {
    ok: bool,
    error: Option<String>,
    workspace: Option<WorkspaceInfo>,
}

#[tauri::command]
fn open_local_repository(app: AppHandle, state: State<AppState>) -> OpenLocalRepoResponse {
    // Show a directory picker dialog
    let selected_dir = FileDialogBuilder::new()
        .set_title("Select a workspace directory")
        .pick_folder();

    let Some(path) = selected_dir else {
        let msg = "No directory selected".to_string();
        println!("[fibbelous] {}", msg);
        return OpenLocalRepoResponse {
            ok: false,
            error: Some(msg),
            workspace: None,
        };
    };

    // Check for workspace.json in the selected directory
    let json_path = path.join("workspace.json");
    let Ok(json) = fs::read_to_string(&json_path) else {
        let msg = format!("workspace.json not found at {}", json_path.display());
        println!("[fibbelous] {}", msg);
        return OpenLocalRepoResponse {
            ok: false,
            error: Some(msg),
            workspace: None,
        };
    };
    let Ok(info) = serde_json::from_str::<WorkspaceInfo>(&json) else {
        let msg = format!("Failed to parse workspace.json at {}", json_path.display());
        println!("[fibbelous] {}", msg);
        return OpenLocalRepoResponse {
            ok: false,
            error: Some(msg),
            workspace: None,
        };
    };

    // Prevent duplicates: if a connection with same id already exists, skip
    {
        let conns = state.connections.lock().expect("mutex poisoned");
        if conns.iter().any(|c| c.id == info.id) {
            let msg = "Workspace with is already loaded".to_string();
            println!("[fibbelous] {}", msg);
            return OpenLocalRepoResponse {
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
            println!("[fibbelous] {}", msg);
            return OpenLocalRepoResponse {
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

    OpenLocalRepoResponse {
        ok: true,
        error: None,
        workspace: Some(info),
    }
}

#[tauri::command]
fn delete_workspace(app: AppHandle, state: State<AppState>, id: String) -> bool {
    match ConnectionManager::delete_connection(&app, &id) {
        Err(err) => {
            println!("[fibbelous] Failed to delete connection {}: {}", id, err);
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
    tauri::Builder::default()
        .setup(|app| {
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
        .invoke_handler(tauri::generate_handler![
            get_saved_workspaces,
            open_local_repository,
            get_saved_connections,
            delete_workspace
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

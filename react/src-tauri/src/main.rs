// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod connections;

use connections::{AppState, ConnectionManager};
use fib_core::command_handler::{execute, Command, CommandEnv, CommandResult};
use fib_core::indexing::init_index_db;
use fib_core::logging;
use fib_core::tracing::info;
use fib_core::workspaces::{WorkspaceConnection, WorkspaceInfo};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

#[tauri::command]
async fn invoke_command(
    state: State<'_, AppState>,
    command: Command,
) -> Result<CommandResult, String> {
    // Snapshot data
    let connections: Vec<WorkspaceConnection> =
        state.connections.lock().expect("mutex poisoned").clone();
    let workspaces: Vec<WorkspaceInfo> = state.workspaces.lock().expect("mutex poisoned").clone();
    let active_ws: Option<WorkspaceInfo> = state
        .active_workspace
        .lock()
        .expect("mutex poisoned")
        .clone();

    // Determine if DB init required (avoid holding lock over await)
    if let Some(ws) = active_ws.as_ref() {
        let needs_init = {
            let dbs = state.workspace_dbs.lock().expect("mutex poisoned");
            !dbs.contains_key(&ws.id)
        };
        if needs_init {
            if let Some(conn) = connections.iter().find(|c| c.id == ws.id) {
                if let Some(path) = &conn.path {
                    let fib_dir = PathBuf::from(path).join(".fibbelous");
                    match init_index_db(&fib_dir).await {
                        Ok(db) => {
                            let mut dbs = state.workspace_dbs.lock().expect("mutex poisoned");
                            dbs.insert(ws.id.clone(), db);
                        }
                        Err(e) => {
                            return Ok(CommandResult::Error(
                                fib_core::command_handler::ErrorPayload {
                                    message: format!("Failed to init index db: {}", e),
                                },
                            ));
                        }
                    }
                }
            }
        }
    }

    let (active_workspace_id, workspace_path_opt) = active_ws
        .as_ref()
        .map(|ws| {
            let path = connections
                .iter()
                .find(|c| c.id == ws.id)
                .and_then(|c| c.path.clone())
                .map(PathBuf::from);
            (Some(ws.id.clone()), path)
        })
        .unwrap_or((None, None));

    let mut env = CommandEnv::new(workspaces.clone(), connections.clone())
        .with_workspace_path(workspace_path_opt);
    env.active_workspace_id = active_workspace_id;
    {
        let dbs = state.workspace_dbs.lock().expect("mutex poisoned");
        for (id, db) in dbs.iter() {
            env.workspace_dbs.insert(id.clone(), db.clone());
        }
    }

    Ok(execute(command, &env).await)
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
                workspace_dbs: Mutex::new(HashMap::new()),
            });
            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                info!(target: "main", "Window '{}' close requested", event.window().label());
            }
        })
        .invoke_handler(tauri::generate_handler![invoke_command]);

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

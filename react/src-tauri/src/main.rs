// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;

use fib_core::command_handler::{BoolPayload, Command, CommandResult};
use fib_core::logging;
use fib_core::state::AppState;
use fib_core::tracing::{debug, error, info};
use fib_core::users::ConnectedUserContext;
use tauri::{Manager, State};

mod connections;

use crate::connections::ConnectionManager;

#[tauri::command]
async fn invoke_command(
    state: State<'_, ConnectedUserContext>,
    command: Command,
) -> Result<CommandResult, String> {
    match command {
        // Local commands
        Command::SwitchWorkspace { id } => {
            let workspace = state.command_handler.app.workspaces.get(&id);
            match workspace {
                None => return Err(format!("Unknown workspace id: {}", id)),
                Some(ws) => {
                    // Assume active_workspace is a RwLock<Option<_>>
                    let mut guard = state.active_workspace.write().await;
                    *guard = Some(ws);
                    Ok(CommandResult::Bool(BoolPayload { value: true }))
                }
            }
        }
        // Core handle the rest
        _ => Ok(state.command_handler.execute(command).await),
    }
}

fn main() {
    // Use Tauri's path resolver for log/data dirs if possible
    let context = tauri::generate_context!();
    let builder = tauri::Builder::default()
        .setup(|app| {
            let resolver = app.path_resolver();
            let data_dir = resolver
                .app_data_dir()
                .unwrap_or_else(|| std::env::temp_dir().join("fibbelous_data"));
            let logs_dir = data_dir.join("logs");
            let verbose = std::env::var("VERBOSE")
                .map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes" | "on"))
                .unwrap_or(false);
            logging::init(logs_dir.as_path(), verbose);

            info!(target: "main", "===========");
            info!(target: "main", "APP STARTED");
            if verbose {
                debug!("Verbose logging enabled");
            }

            info!(target: "main", "App storage is at {}", data_dir.display());
            // Initialize AppState using the shared core async initializer
            let rt: tokio::runtime::Runtime =
                tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
            let connection_manager = ConnectionManager::new(&data_dir);
            let connections = connection_manager.load_saved_connections();
            let mut app_state = rt.block_on(AppState::init_new(data_dir.clone()));

            rt.block_on(async {
                for conn in connections {
                    if let Err(e) = app_state.workspaces.load_connection(conn).await {
                        error!(target: "main", "Failed to add saved connection: {}", e);
                    }
                }
            });

            app.manage(ConnectedUserContext::new_local(Arc::new(app_state)));
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

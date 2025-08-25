// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use lib::workspaces::WorkspaceInfo;
use std::fs;
use tauri::api::dialog::blocking::FileDialogBuilder;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_saved_workspaces() -> Vec<WorkspaceInfo> {
    let workspaces = match lib::workspaces::list() {
        Ok(list) => list,
        Err(e) => {
            // handle error, e.g. log or return
            vec![]
        }
    };

    workspaces
}

#[tauri::command]
fn open_local_repository() -> Option<WorkspaceInfo> {
    // Show a directory picker dialog
    let selected = FileDialogBuilder::new()
        .set_title("Select a workspace directory")
        .pick_folder();

    let Some(path) = selected else {
        return None;
    };

    // Check for workspace.json in the selected directory
    let json_path = path.join("workspace.json");
    let Ok(json) = fs::read_to_string(&json_path) else {
        return None;
    };
    let Ok(info) = serde_json::from_str::<WorkspaceInfo>(&json) else {
        return None;
    };
    Some(info)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            greet,
            get_saved_workspaces,
            open_local_repository
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::collections::HashMap;
use std::sync::Mutex;

use serde_json::Value;
use server::rpc::call_workspace_rpc;
use server::workspace::{
    OpenWorkspaceOutcome, Workspace, WorkspaceInfo, open_workspace_at_path, spawn_indexing,
};
use tauri::State;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct LocalWorkspaces {
    workspaces: Mutex<HashMap<String, Workspace>>,
}

impl LocalWorkspaces {
    fn new() -> Self {
        Self {
            workspaces: Mutex::new(HashMap::new()),
        }
    }

    fn snapshot(&self) -> Vec<Workspace> {
        self.workspaces
            .lock()
            .expect("local workspaces mutex poisoned")
            .values()
            .cloned()
            .collect()
    }

    fn insert(&self, workspace: Workspace) {
        self.workspaces
            .lock()
            .expect("local workspaces mutex poisoned")
            .insert(workspace.id.clone(), workspace);
    }

    fn get(&self, id: &str) -> Option<Workspace> {
        self.workspaces
            .lock()
            .expect("local workspaces mutex poisoned")
            .get(id)
            .cloned()
    }
}

#[tauri::command]
async fn open_local_workspace(
    path: String,
    state: State<'_, LocalWorkspaces>,
) -> Result<WorkspaceInfo, String> {
    let existing = state.snapshot();
    match open_workspace_at_path(&existing, &path).map_err(|error| error.message())? {
        OpenWorkspaceOutcome::AlreadyLoaded(info) => Ok(info),
        OpenWorkspaceOutcome::Opened(workspace) => {
            let info = workspace.info();
            state.insert(workspace.clone());
            spawn_indexing(workspace);
            Ok(info)
        }
    }
}

#[tauri::command]
async fn local_workspace_rpc(
    workspace_id: String,
    method: String,
    params: Option<Value>,
    state: State<'_, LocalWorkspaces>,
) -> Result<Value, String> {
    let workspace = state
        .get(&workspace_id)
        .ok_or_else(|| "workspace not found".to_owned())?;
    call_workspace_rpc(&workspace, &method, params.unwrap_or(Value::Null)).await
}

#[tauri::command]
async fn update_local_workspace_settings(
    workspace_id: String,
    title: Option<String>,
    slug: Option<String>,
    icon: Option<String>,
    state: State<'_, LocalWorkspaces>,
) -> Result<WorkspaceInfo, String> {
    use server::workspace::UpdateWorkspaceRequest;

    let mut guard = state
        .workspaces
        .lock()
        .expect("local workspaces mutex poisoned");
    let snapshot: Vec<Workspace> = guard.values().cloned().collect();
    let workspace = guard
        .get_mut(&workspace_id)
        .ok_or_else(|| "workspace not found".to_owned())?;
    workspace
        .update_settings(
            &snapshot,
            UpdateWorkspaceRequest { title, slug, icon },
        )
        .map_err(|error| match error {
            server::workspace::UpdateWorkspaceError::Validation(message) => message,
            server::workspace::UpdateWorkspaceError::SlugConflict => {
                "slug already exists".to_owned()
            }
            server::workspace::UpdateWorkspaceError::NotFound => {
                "workspace not found".to_owned()
            }
            server::workspace::UpdateWorkspaceError::Io(error) => error.to_string(),
        })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(LocalWorkspaces::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            open_local_workspace,
            local_workspace_rpc,
            update_local_workspace_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use std::sync::Arc;

use crate::workspaces::WorkspaceManager;

#[derive(Clone)]
pub struct AppState {
    pub workspace_manager: Arc<WorkspaceManager>,
}

/// Load all workspaces from storage and create an initial `AppState`.
pub async fn init_app_state() -> AppState {
    let workspace_manager = Arc::new(WorkspaceManager::init().await);

    AppState { workspace_manager }
}

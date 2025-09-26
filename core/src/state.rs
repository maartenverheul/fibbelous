use std::path::PathBuf;

use crate::{users::UserManager, workspaces::WorkspaceManager};

pub struct AppState {
    pub data_dir: PathBuf,
    pub workspaces: WorkspaceManager,
    pub users: UserManager,
}

impl AppState {
    pub async fn init_new(data_dir: PathBuf) -> AppState {
        let workspace_dir = data_dir.join("workspaces");
        let workspace_manager = WorkspaceManager::new(workspace_dir);
        let user_manager = UserManager::new();

        AppState {
            data_dir,
            workspaces: workspace_manager,
            users: user_manager,
        }
    }
}

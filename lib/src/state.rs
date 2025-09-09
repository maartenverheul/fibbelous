use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

use sea_orm::DatabaseConnection;

use crate::{
    command_handler::CommandEnv,
    workspaces::{CreateWorkspaceRequest, WorkspaceInfo},
};

// Placeholder handlers for CRUD endpoints
#[derive(Clone)]
pub struct WorkspaceState {
    pub id: String,
    pub path: std::path::PathBuf,
    pub info: crate::workspaces::WorkspaceInfo,
    pub db: DatabaseConnection,
}

#[derive(Clone)]
pub struct AppState {
    pub workspaces: Arc<RwLock<HashMap<String, Arc<WorkspaceState>>>>,
    pub env: Arc<RwLock<CommandEnv>>,
}

impl AppState {
    pub async fn add_workspace_from_request(
        &self,
        req: CreateWorkspaceRequest,
    ) -> Result<WorkspaceInfo, String> {
        // Build workspace info
        let loaded = crate::workspaces::create_workspace_from_request(req).await?;
        let info = loaded.info.clone();
        {
            let mut w_guard = self.workspaces.write().await;
            w_guard.insert(loaded.id.clone(), Arc::new(loaded));
        }
        {
            let mut env_guard = self.env.write().await;
            env_guard.workspaces.push(info.clone());
        }
        Ok(info)
    }
}

/// Load all workspaces from storage and create an initial `AppState`.
pub async fn init_app_state() -> AppState {
    let loaded = crate::workspaces::load_all_workspaces().await;
    let mut workspaces_map: HashMap<String, Arc<WorkspaceState>> = HashMap::new();
    for w in loaded {
        let info_clone = w.info.clone();
        workspaces_map.insert(
            w.id.clone(),
            Arc::new(WorkspaceState {
                id: w.id,
                path: w.path,
                info: info_clone,
                db: w.db,
            }),
        );
    }
    let env = CommandEnv::new(
        workspaces_map.values().map(|w| w.info.clone()).collect(),
        vec![],
    );
    AppState {
        workspaces: Arc::new(RwLock::new(workspaces_map)),
        env: Arc::new(RwLock::new(env)),
    }
}

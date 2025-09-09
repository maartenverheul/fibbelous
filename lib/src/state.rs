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
    pub workspaces: Arc<RwLock<HashMap<String, WorkspaceState>>>,
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
            w_guard.insert(loaded.id.clone(), loaded);
        }
        {
            let mut env_guard = self.env.write().await;
            env_guard.workspaces.push(info.clone());
        }
        Ok(info)
    }
}

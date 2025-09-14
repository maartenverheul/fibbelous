use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

use crate::workspaces::LoadedWorkspace;

#[derive(Clone)]
pub struct AppState {
    pub workspaces: Arc<RwLock<HashMap<String, Arc<LoadedWorkspace>>>>,
}

/// Load all workspaces from storage and create an initial `AppState`.
pub async fn init_app_state() -> AppState {
    let loaded = crate::workspaces::load_all_workspaces().await;
    let mut workspaces_map: HashMap<String, Arc<LoadedWorkspace>> = HashMap::new();
    for w in loaded {
        workspaces_map.insert(w.id.clone(), Arc::new(w.clone()));
    }
    AppState {
        workspaces: Arc::new(RwLock::new(workspaces_map)),
    }
}

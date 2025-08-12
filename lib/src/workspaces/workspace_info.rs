use serde::{Deserialize, Serialize};

use crate::id::generate_hex_id;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceInfo {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
    pub created_at: Option<String>,
}

impl WorkspaceInfo {
    pub fn default_workspace() -> Self {
        let now = chrono::Utc::now();
        let created_at = now.format("%Y-%m-%dT%H:%M:%S%:z").to_string();
        Self {
            id: generate_hex_id(),
            slug: "default".to_string(),
            title: "Default workspace".to_string(),
            description: Some("The default workspace".to_string()),
            created_at: Some(created_at),
        }
    }
}

pub struct NewWorkspace {
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
}

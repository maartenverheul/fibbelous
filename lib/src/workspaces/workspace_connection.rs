use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConnection {
    pub id: String,
    pub path: Option<String>,
    pub url: Option<String>,
    pub git: Option<String>,
}

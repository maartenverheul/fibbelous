use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Database {
    pub id: String,
    pub title: String,
    pub cover: Option<String>,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
}

use serde::{Deserialize, Serialize};
use tracing::{error, info};

use crate::id::generate_hex_id;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub cover: Option<String>,
    pub icon: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
    pub deleted_at: Option<String>,
}

impl Page {
    pub fn create_default(parent_id: Option<String>) -> Self {
        // Replace the following with actual default initialization logic for Page
        Page {
            // Example fields; replace with actual fields of Page
            id: generate_hex_id(),
            parent_id,
            title: "Untitled".into(),
            cover: None,
            icon: Some("📗".into()),
            created_at: chrono::Utc::now().to_string(),
            updated_at: None,
            deleted_at: None,
        }
    }
}
/// Creates a new .mdx file for the given page in the workspace's `pages` directory.
pub fn save_page(workspace_path: &Path, page: &Page) -> Result<(), String> {
    let pages_dir = workspace_path.join("pages");
    if !pages_dir.exists() {
        info!("Pages directory does not exist. Creating: {:?}", pages_dir);
        if let Err(e) = fs::create_dir_all(&pages_dir) {
            error!("Failed to create pages directory: {}", e);
            return Err(format!("Failed to create pages directory: {}", e));
        }
    }

    let filename = format!("{}.mdx", page.id);
    let file_path = pages_dir.join(filename);

    let content = format!(
        "---\ntitle: \"{}\"\nid: \"{}\"\n---\n\n# {}\n",
        page.title, page.id, page.title
    );

    info!(
        "Writing .mdx file for page '{}' at {:?}",
        page.title, file_path
    );
    if let Err(e) = fs::write(&file_path, content) {
        error!("Failed to write .mdx file: {}", e);
        return Err(format!("Failed to write .mdx file: {}", e));
    }
    Ok(())
}

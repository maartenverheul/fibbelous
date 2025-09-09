use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use slugify::slugify;
use tracing::{error, info};

use crate::id::generate_hex_id;
use crate::workspaces::WorkspaceConnection;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub cover: Option<String>,
    pub icon: Option<String>,
    #[serde(with = "crate::time::serde_rfc3339_secs")]
    pub created_at: DateTime<Utc>,
    #[serde(with = "crate::time::serde_opt_rfc3339_secs")]
    pub updated_at: Option<DateTime<Utc>>,
    #[serde(with = "crate::time::serde_opt_rfc3339_secs")]
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Page {
    pub fn default(parent_id: Option<String>) -> Self {
        // Replace the following with actual default initialization logic for Page
        Page {
            // Example fields; replace with actual fields of Page
            id: generate_hex_id(),
            parent_id,
            title: "Untitled".into(),
            cover: None,
            icon: Some("📗".into()),
            created_at: chrono::Utc::now(),
            updated_at: None,
            deleted_at: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageWithContent {
    pub page: Page,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TOCItem {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub icon: Option<String>,
    pub children: Vec<Page>,
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

    let slug = slugify!(&page.title);
    let filename = format!("{}-{}.mdx", page.id, slug);
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

pub fn read_page(
    workspace: &WorkspaceConnection,
    page_id: &str,
) -> Result<PageWithContent, String> {
    let path = workspace.path.as_ref().ok_or("Workspace path is not set")?;
    let pages_dir = path.join("pages");
    let slug = slugify!(page_id);
    let file_path = pages_dir.join(format!("{}-{}.mdx", page_id, slug));

    let content = fs::read_to_string(&file_path).map_err(|e| {
        error!("Failed to read .mdx file: {}", e);
        format!("Failed to read .mdx file: {}", e)
    })?;

    let page: Page = serde_json::from_str(&content).map_err(|e| {
        error!("Failed to parse .mdx file: {}", e);
        format!("Failed to parse .mdx file: {}", e)
    })?;

    Ok(PageWithContent { page, content })
}

pub fn get_page_path(workspace: &WorkspaceConnection, page_id: &str) -> Result<PathBuf, String> {
    let path = workspace.path.as_ref().ok_or("Workspace path is not set")?;
    let pages_dir = path.join("pages");
    let slug = slugify!(page_id);
    let file_path = pages_dir.join(format!("{}-{}.mdx", page_id, slug));
    Ok(file_path)
}

pub fn get_child_pages(
    workspace: &WorkspaceConnection,
    parent_id: &str,
) -> Result<Vec<Page>, String> {
    // let pages = get_all_pages(workspace)?;
    // let child_pages = pages
    //     .into_iter()
    //     .filter(|page| page.parent_id.as_ref() == Some(parent_id))
    //     .collect();
    // Ok(child_pages)
    Ok(vec![]) // Placeholder implementation
}

pub fn make_toc(workspace: &WorkspaceConnection, parent_id: &str) -> Result<Vec<TOCItem>, String> {
    let pages = get_child_pages(workspace, parent_id)?;
    let mut toc = Vec::new();

    for page in pages {
        let item = TOCItem {
            id: page.id,
            title: page.title.clone(),
            slug: slugify!(&page.title),
            icon: page.icon,
            children: Vec::new(),
        };
        toc.push(item);
    }

    Ok(toc)
}

pub fn walk_workspace_pages(
    workspace: &WorkspaceConnection,
    dir: &Path,
) -> Result<Vec<Page>, String> {
    let mut pages = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                let mut sub_pages = walk_workspace_pages(workspace, &path)?;
                pages.append(&mut sub_pages);
            } else if path.extension().and_then(|s| s.to_str()) == Some("mdx") {
                let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
                let page: Page = serde_json::from_str(&content).map_err(|e| e.to_string())?;
                pages.push(page);
            }
        }
    }
    Ok(pages)
}

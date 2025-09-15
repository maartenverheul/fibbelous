use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use slugify::slugify;
use tokio::sync::RwLock;
use tracing::{debug, error, info};

use crate::id::generate_hex_id;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub slug: String,
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
            slug: "untitled".into(),
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
    pub url: String,
    pub icon: Option<String>,
    pub children: Vec<Page>,
}

#[derive(Debug, Deserialize)]
struct RawFrontmatter {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    parent_id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    slug: Option<String>,
    #[serde(default)]
    cover: Option<String>,
    #[serde(default)]
    icon: Option<String>,
    // Timestamps may not be present in frontmatter; we'll generate if missing
}

#[derive(Debug)]
pub struct PageManager {
    pages_dir: PathBuf,
    indexed_pages: RwLock<HashMap<String, Page>>,
}

impl PageManager {
    pub fn new(workspace_path: PathBuf) -> Self {
        let workspace_path = workspace_path.clone();
        Self {
            pages_dir: workspace_path.join("pages"),
            indexed_pages: RwLock::new(HashMap::new()),
        }
    }

    pub async fn index_pages(&self) -> Result<(), String> {
        info!("Indexing pages in {:?}", self.pages_dir);
        let pages = self.walk_dir_pages(&self.pages_dir);
        let mut guard = self.indexed_pages.write().await;
        guard.clear();
        for page in pages {
            guard.insert(page.id.clone(), page);
        }
        info!("Indexed {} pages", guard.len());
        Ok(())
    }

    pub fn read_page(&self, page_id: &str) -> Result<PageWithContent, String> {
        if !self.pages_dir.is_dir() {
            return Err("Pages directory missing".into());
        }

        // Files are stored as: <id>-<slugified-title>.mdx. We only know the id here.
        let mut target: Option<std::path::PathBuf> = None;
        for entry in
            fs::read_dir(&self.pages_dir).map_err(|e| format!("Failed to list pages: {}", e))?
        {
            let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
            let p = entry.path();
            if p.extension().and_then(|s| s.to_str()) != Some("mdx") {
                continue;
            }
            if let Some(fname) = p.file_name().and_then(|s| s.to_str()) {
                if fname.starts_with(page_id) && fname.as_bytes().get(page_id.len()) == Some(&b'-')
                {
                    target = Some(p.clone());
                    break;
                }
            }
        }
        let file_path = target.ok_or_else(|| format!("Page file for id {} not found", page_id))?;

        let raw = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read .mdx file: {}", e))?;

        let (page_meta, body) = self
            .parse_frontmatter(&raw)
            .map_err(|e| format!("Failed to parse frontmatter: {}", e))?;

        Ok(PageWithContent {
            page: page_meta,
            content: body.to_string(),
        })
    }

    /// Creates a new .mdx file for the given page in the workspace's `pages` directory.
    pub async fn save_page(&self, page: &Page) -> Result<(), String> {
        info!("Saving page \"{:?}\"", page.id);
        if !self.pages_dir.exists() {
            info!(
                "Pages directory does not exist. Creating: {:?}",
                self.pages_dir
            );
            if let Err(e) = fs::create_dir_all(&self.pages_dir) {
                error!("Failed to create pages directory: {}", e);
                return Err(format!("Failed to create pages directory: {}", e));
            }
        }

        let slug = slugify!(&page.title);
        let filename = format!("{}-{}.mdx", page.id, slug);
        let file_path = self.pages_dir.join(filename);

        let content = format!(
            "---\ntitle: {}\nid: {}\n---\n\n# {}\n",
            page.title, page.id, page.title
        );

        debug!(
            "Writing .mdx file for page '{}' at {:?}",
            page.title, file_path
        );
        if let Err(e) = fs::write(&file_path, content) {
            error!("Failed to write .mdx file: {}", e);
            return Err(format!("Failed to write .mdx file: {}", e));
        }

        self.indexed_pages
            .write()
            .await
            .insert(page.id.clone(), page.clone());

        Ok(())
    }

    pub async fn delete_page(&self, page_id: &str) -> Result<(), String> {
        debug!("Deleting page {}", page_id);

        let file_path = self.get_page_path(page_id).await?;
        if !file_path.exists() {
            error!("Page file {:?} does not exist", file_path);
            return Err(format!("Page file {:?} does not exist", file_path));
        }

        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete page file {:?}: {}", file_path, e))?;

        self.indexed_pages.write().await.remove(page_id);

        Ok(())
    }

    pub async fn build_page_tree(&self, page_id: &str) -> Result<Vec<Page>, String> {
        let guard = self.indexed_pages.read().await;
        let mut tree = Vec::new();
        let mut current = match guard.get(page_id) {
            Some(p) => p,
            None => return Err(format!("Page {} not found in index", page_id)),
        };
        while let Some(parent_id) = &current.parent_id {
            tree.push(current.clone());
            current = match guard.get(parent_id) {
                Some(p) => p,
                None => {
                    return Err(format!(
                        "Parent page {} (referenced by {}) not found in index",
                        parent_id, current.id
                    ))
                }
            };
        }

        tree.reverse();
        tree.push(current.clone());
        Ok(tree)
    }

    pub async fn get_page_path(&self, page_id: &str) -> Result<PathBuf, String> {
        let mut tree = self.build_page_tree(page_id).await?;
        let last = tree.pop().unwrap();
        let middle = tree
            .iter()
            .map(|page| page.id.as_str())
            .collect::<Vec<_>>()
            .join("/");
        let file_path = self
            .pages_dir
            .join(middle)
            .join(format!("{}-{}.mdx", page_id, last.slug));
        Ok(file_path)
    }

    pub async fn get_child_pages(&self, _parent_id: Option<&str>) -> Result<Vec<Page>, String> {
        let guard = self.indexed_pages.read().await;
        Ok(guard
            .values()
            .filter(|page| page.parent_id.as_deref() == _parent_id)
            .cloned()
            .collect())
    }

    pub async fn get_page_url(&self, page: &Page) -> Result<String, String> {
        let tree = self.build_page_tree(&page.id).await?;
        let middle = tree
            .iter()
            .map(|page| page.slug.as_str())
            .collect::<Vec<_>>()
            .join("/");
        let slug = tree
            .last()
            .map(|p| p.slug.as_str())
            .ok_or_else(|| "Unexpected empty tree when accessing slug".to_string())?;
        Ok(format!("/workspace/{}/{}-{}.mdx", middle, page.id, slug))
    }

    pub async fn make_toc(&self, parent_id: Option<&str>) -> Result<Vec<TOCItem>, String> {
        let pages = self.get_child_pages(parent_id).await?;
        let mut toc = Vec::new();

        for page in pages {
            let item = TOCItem {
                id: page.id.clone(),
                title: page.title.clone(),
                url: self.get_page_url(&page).await.unwrap_or("".into()),
                slug: page.slug,
                icon: page.icon,
                children: Vec::new(),
            };
            toc.push(item);
        }

        Ok(toc)
    }

    pub fn walk_dir_pages(&self, dir: &Path) -> Vec<Page> {
        if !dir.is_dir() {
            return Vec::new();
        }

        let mut pages = Vec::new();
        let entries = match fs::read_dir(dir) {
            Ok(e) => e,
            Err(e) => {
                error!("Failed to read directory {:?}: {}", dir, e);
                return pages;
            }
        };

        for entry_result in entries {
            let entry = match entry_result {
                Ok(en) => en,
                Err(e) => {
                    error!("Failed to read entry in {:?}: {}", dir, e);
                    continue;
                }
            };
            let path = entry.path();

            if path.is_dir() {
                pages.extend(self.walk_dir_pages(&path));
                continue;
            }

            if path.extension().and_then(|s| s.to_str()) != Some("mdx") {
                continue;
            }

            let text = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(e) => {
                    error!("Failed to read file {:?}: {}", path, e);
                    continue;
                }
            };
            match self.parse_frontmatter(&text) {
                Ok((page, _body)) => pages.push(page),
                Err(e) => error!("Failed to parse page file {:?}: {}", path, e),
            }
        }

        pages
    }

    fn parse_frontmatter<'a>(&self, input: &'a str) -> Result<(Page, &'a str), String> {
        let trimmed = input.trim_start();
        let rest = if let Some(stripped) = trimmed.strip_prefix("---\n") {
            stripped
        } else {
            return Err("Missing frontmatter opening '---'".into());
        };
        // Scan lines until closing '---'
        // Manual scan lines
        let mut lines = rest.lines();
        let mut fm_lines = Vec::new();
        let mut consumed = 0usize; // bytes consumed in rest
        while let Some(l) = lines.next() {
            if l.trim() == "---" {
                break;
            } else {
                fm_lines.push(l);
                consumed += l.len() + 1;
            }
        }
        if fm_lines.is_empty() {
            return Err("Empty or invalid frontmatter".into());
        }
        let fm_raw = fm_lines.join("\n");
        let body_start = &rest[consumed + 4..]; // skip closing --- + newline (approx)
        let raw: RawFrontmatter = match serde_yaml::from_str(&fm_raw) {
            Ok(v) => v,
            Err(e) => return Err(format!("YAML error: {}", e)),
        };
        let title = raw.title.unwrap_or_else(|| "Untitled".into());
        let slug = raw.slug.unwrap_or_else(|| slugify!(&title));
        let id = raw.id.unwrap_or_else(|| generate_hex_id());
        let page = Page {
            id,
            parent_id: raw.parent_id,
            title: title.clone(),
            slug,
            cover: raw.cover,
            icon: raw.icon.or(Some("📗".into())),
            created_at: Utc::now(),
            updated_at: None,
            deleted_at: None,
        };
        Ok((page, body_start))
    }
}

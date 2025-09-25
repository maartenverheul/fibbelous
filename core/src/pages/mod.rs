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
    pub parent_id: Option<String>,
    pub title: String,
    pub slug: String,
    pub url: String,
    pub icon: Option<String>,
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
    workspace_slug: String,
}

impl PageManager {
    pub fn new(workspace_path: PathBuf, workspace_slug: String) -> Self {
        let workspace_path = workspace_path.clone();
        Self {
            pages_dir: workspace_path.join("pages"),
            indexed_pages: RwLock::new(HashMap::new()),
            workspace_slug,
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
        // Use recursive search to locate file anywhere in hierarchy.
        let file_path = self
            .find_page_file(page_id)
            .ok_or_else(|| format!("Page file for id {} not found", page_id))?;

        let raw = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read .mdx file: {}", e))?;

        let (page_meta_tmp, body) = self
            .parse_frontmatter(&raw)
            .map_err(|e| format!("Failed to parse frontmatter: {}", e))?;
        let mut page_meta = page_meta_tmp;
        // Derive parent_id from directory structure if not already set (or to override legacy value)
        if let Ok(rel) = file_path.strip_prefix(&self.pages_dir) {
            if let Some(parent_dir) = rel.parent().and_then(|p| p.file_name()) {
                if let Some(pid) = parent_dir.to_str() {
                    if !pid.is_empty() {
                        page_meta.parent_id = Some(pid.to_string());
                    }
                }
            }
        }
        // Remove the first blank line after the frontmatter (we always enforce exactly one blank line on write).
        let trimmed_body = if body.starts_with("\r\n") {
            &body[2..]
        } else if body.starts_with('\n') {
            &body[1..]
        } else {
            body
        };

        Ok(PageWithContent {
            page: page_meta,
            content: trimmed_body.to_string(),
        })
    }

    /// Creates a new .mdx file for the given page in the workspace's `pages` directory.
    pub async fn save_page(&self, page: &Page) -> Result<(), String> {
        info!("Saving page {:?}", page.id);
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

        // Determine parent directory chain based on ancestor ids (not slugs) so we can later derive parent_id from path.
        let parent_dir = self.parent_dir_for(page).await;
        let slug = slugify!(&page.title);
        let filename = format!("{}-{}.mdx", page.id, slug);
        let file_path = parent_dir.join(filename);
        if let Some(dir) = file_path.parent() {
            if !dir.exists() {
                fs::create_dir_all(dir)
                    .map_err(|e| format!("Failed to create parent directories: {e}"))?;
            }
        }
        // Minimal frontmatter: omit parent_id (derivable from path hierarchy).
        let content = format!(
            "---\ntitle: {}\nid: {}\nslug: {}\n---\n\n# {}\n",
            page.title, page.id, slug, page.title
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

    /// Write full page (frontmatter + body). Rewrites file (may rename if title/slug changed).
    pub async fn write_full_page(&self, page: &Page, body: &str) -> Result<(), String> {
        if !self.pages_dir.exists() {
            fs::create_dir_all(&self.pages_dir)
                .map_err(|e| format!("Failed creating pages dir: {e}"))?;
        }

        // Remove any existing file (in any subdirectory) matching the page id (old slug) to avoid stale duplicates.
        if let Some(existing) = self.find_page_file(&page.id) {
            let _ = fs::remove_file(existing);
        }

        // Build hierarchical directory path from parent chain (ids).
        let parent_dir = self.parent_dir_for(page).await;
        if !parent_dir.exists() {
            fs::create_dir_all(&parent_dir)
                .map_err(|e| format!("Failed to create parent directory chain: {e}"))?;
        }
        let filename = format!("{}-{}.mdx", page.id, page.slug);
        let file_path = parent_dir.join(filename);
        let fm_value = serde_json::json!({
            "id": page.id,
            "title": page.title,
            "slug": page.slug,
            "cover": page.cover,
            "icon": page.icon,
        });
        let frontmatter = serde_yaml::to_string(&fm_value)
            .map_err(|e| format!("Failed to serialize frontmatter: {e}"))?;
        // Ensure single blank line separating frontmatter and content.
        // 1. Remove trailing newlines from serialized frontmatter.
        let frontmatter_clean = frontmatter.trim_end_matches(['\n', '\r'].as_ref());
        // 2. Trim leading blank lines from body to avoid accumulating empties over successive writes.
        let body_clean = body.trim_start_matches(|c| c == '\n' || c == '\r');
        // Final layout:
        // ---\n<frontmatter>\n---\n\n<body>
        let data = format!("---\n{}\n---\n\n{}", frontmatter_clean, body_clean);
        fs::write(&file_path, data).map_err(|e| format!("Failed to write page file: {e}"))?;
        self.indexed_pages
            .write()
            .await
            .insert(page.id.clone(), page.clone());
        Ok(())
    }

    pub async fn build_page_tree(&self, page_id: &str) -> Result<Vec<Page>, String> {
        // Collect chain leaf->root, then reverse to root->leaf.
        let guard = self.indexed_pages.read().await;
        let mut chain: Vec<Page> = Vec::new();
        let mut current_id = page_id;
        loop {
            let page = guard
                .get(current_id)
                .ok_or_else(|| format!("Page {} not found in index", current_id))?;
            chain.push(page.clone());
            if let Some(pid) = &page.parent_id {
                current_id = pid;
            } else {
                break;
            }
        }
        chain.reverse();
        Ok(chain)
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
        let tree = self.build_page_tree(&page.id).await?; // root..leaf
        if tree.is_empty() {
            return Err("Page tree empty".into());
        }
        let ids: Vec<&str> = tree.iter().map(|p| p.id.as_str()).collect();
        let leaf_slug = tree.last().unwrap().slug.clone();
        let prefix = if ids.is_empty() {
            String::new()
        } else {
            format!("{}/", ids.join("/"))
        };
        Ok(format!(
            "/{}/{}{}-{}",
            self.workspace_slug, prefix, page.id, leaf_slug
        ))
    }

    pub async fn make_toc(
        &self,
        parent_id: Option<&str>,
        depth: Option<i8>,
    ) -> Result<Vec<TOCItem>, String> {
        // depth = number of child layers to return (1 => direct children only).
        // If depth <= 0, return empty.
        let max_layers = depth.unwrap_or(1); // preserve previous default of 1 layer
        if max_layers <= 0 {
            return Ok(Vec::new());
        }

        use std::collections::VecDeque;
        let mut queue: VecDeque<(Option<String>, i8)> = VecDeque::new();
        queue.push_back((parent_id.map(|s| s.to_string()), 0)); // level 0 is the starting parent placeholder
        let mut results: Vec<TOCItem> = Vec::new();

        while let Some((current_parent, level)) = queue.pop_front() {
            if level == max_layers {
                continue;
            } // reached requested depth; do not expand further
            let children = self.get_child_pages(current_parent.as_deref()).await?;
            for child in children {
                // level+1 is this child's depth relative to starting parent
                results.push(TOCItem {
                    id: child.id.clone(),
                    parent_id: child.parent_id.clone(),
                    title: child.title.clone(),
                    slug: child.slug.clone(),
                    url: self.get_page_url(&child).await.unwrap_or_default(),
                    icon: child.icon.clone(),
                });
                if level + 1 < max_layers {
                    // still can go deeper
                    queue.push_back((Some(child.id.clone()), level + 1));
                }
            }
        }
        Ok(results)
    }

    // collect_descendants removed: TOC now flattened; each item carries parent_id.

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
                Ok((mut page, _body)) => {
                    // Derive parent_id from relative directory structure: pages/<parent_id>/<parent_id>/<id-slug>.mdx
                    if let Ok(rel) = path.strip_prefix(&self.pages_dir) {
                        if let Some(parent_component) = rel.parent().and_then(|p| p.file_name()) {
                            if let Some(parent_id) = parent_component.to_str() {
                                if !parent_id.is_empty() {
                                    page.parent_id = Some(parent_id.to_string());
                                }
                            }
                        }
                    }
                    pages.push(page)
                }
                Err(e) => error!("Failed to parse page file {:?}: {}", path, e),
            }
        }

        pages
    }

    pub async fn make_toc_item(&self, page: &Page) -> TOCItem {
        TOCItem {
            id: page.id.clone(),
            parent_id: page.parent_id.clone(),
            title: page.title.clone(),
            slug: page.slug.clone(),
            url: self.get_page_url(page).await.unwrap_or("".into()),
            icon: page.icon.clone(),
        }
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
            // parent_id is no longer stored in frontmatter; will be derived from directory path during indexing.
            parent_id: raw.parent_id, // keep optional read for backward compatibility
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

    // Helper: recursively search for an existing page file by id anywhere under pages_dir.
    fn find_page_file(&self, page_id: &str) -> Option<PathBuf> {
        fn recurse(dir: &Path, page_id: &str) -> Option<PathBuf> {
            let entries = fs::read_dir(dir).ok()?;
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() {
                    if let Some(found) = recurse(&p, page_id) {
                        return Some(found);
                    }
                } else if p.extension().and_then(|s| s.to_str()) == Some("mdx") {
                    if let Some(fname) = p.file_name().and_then(|s| s.to_str()) {
                        if fname.starts_with(page_id)
                            && fname.as_bytes().get(page_id.len()) == Some(&b'-')
                        {
                            return Some(p);
                        }
                    }
                }
            }
            None
        }
        recurse(&self.pages_dir, page_id)
    }

    // Build the parent directory path (pages_dir / <ancestor_id>/...) for a page.
    async fn parent_dir_for(&self, page: &Page) -> PathBuf {
        // Gather chain of ancestor ids (root first) by following parent_id links in the current index.
        let mut chain: Vec<String> = Vec::new();
        if page.parent_id.is_some() {
            let guard = self.indexed_pages.read().await;
            let mut current = page.parent_id.clone();
            while let Some(pid) = current {
                chain.push(pid.clone());
                current = guard.get(&pid).and_then(|p| p.parent_id.clone());
            }
            chain.reverse();
        }
        let mut dir = self.pages_dir.clone();
        for id in chain {
            dir = dir.join(id);
        }
        dir
    }
}

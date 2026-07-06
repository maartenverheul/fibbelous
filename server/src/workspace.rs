use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

use crate::cache::{CacheDb, ensure_runtime_dir};
use crate::data::log_path;
use crate::index::sync_workspace;
use crate::pages::{
    CreatePageInput, UpdatePageInput, create_page, duplicate_page, get_trashed_page,
    list_trashed_pages, purge_page, restore_page, trash_page, update_page,
};

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum IndexStatus {
    Pending,
    Indexing,
    Ready,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSettings {
    pub slug: String,
    pub name: String,
    pub icon: String,
    pub created_at: String,
}

#[derive(Clone)]
pub struct Workspace {
    pub id: String,
    pub path: PathBuf,
    pub settings: WorkspaceSettings,
    cache: Arc<Mutex<CacheDb>>,
    index_status: Arc<Mutex<IndexStatus>>,
}

impl std::fmt::Debug for Workspace {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Workspace")
            .field("id", &self.id)
            .field("path", &self.path)
            .field("settings", &self.settings)
            .field("index_status", &self.index_status())
            .finish_non_exhaustive()
    }
}

#[derive(Serialize)]
pub struct WorkspaceInfo {
    pub id: String,
    pub index_status: IndexStatus,
    #[serde(flatten)]
    pub settings: WorkspaceSettings,
}

impl Workspace {
    pub fn index_status(&self) -> IndexStatus {
        *self
            .index_status
            .lock()
            .expect("index status mutex poisoned")
    }

    fn set_index_status(&self, status: IndexStatus) {
        *self
            .index_status
            .lock()
            .expect("index status mutex poisoned") = status;
    }

    pub fn info(&self) -> WorkspaceInfo {
        WorkspaceInfo {
            id: self.id.clone(),
            index_status: self.index_status(),
            settings: self.settings.clone(),
        }
    }

    pub fn list_pages(&self, parent_path: Option<&str>) -> Result<Vec<crate::cache::PageSummary>, String> {
        let parent_dir = parent_path.unwrap_or("pages");
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        cache
            .list_pages_in_dir(parent_dir)
            .map_err(|error| error.to_string())
    }

    pub fn get_page(&self, id: &str) -> Result<Option<crate::cache::PageDetail>, String> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        cache
            .get_page_by_id(id)
            .map_err(|error| error.to_string())
    }

    fn with_cache_mut<T>(
        &self,
        operation: impl FnOnce(&PathBuf, &mut CacheDb) -> Result<T, String>,
    ) -> Result<T, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        operation(&self.path, &mut cache)
    }

    pub fn create_page(&self, input: CreatePageInput) -> Result<crate::cache::PageDetail, String> {
        self.with_cache_mut(|path, cache| create_page(path, cache, input))
    }

    pub fn update_page(&self, input: UpdatePageInput) -> Result<crate::cache::PageDetail, String> {
        self.with_cache_mut(|path, cache| update_page(path, cache, input))
    }

    pub fn trash_page(&self, id: &str) -> Result<Vec<String>, String> {
        self.with_cache_mut(|path, cache| trash_page(path, cache, id))
    }

    pub fn list_trashed_pages(&self) -> Result<Vec<crate::pages::TrashedPageSummary>, String> {
        list_trashed_pages(&self.path)
    }

    pub fn get_trashed_page(&self, id: &str) -> Result<Option<crate::pages::TrashedPageDetail>, String> {
        match get_trashed_page(&self.path, id) {
            Ok(detail) => Ok(Some(detail)),
            Err(error) if error == "page not found in trash" => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn restore_page(&self, id: &str) -> Result<crate::cache::PageDetail, String> {
        self.with_cache_mut(|path, cache| restore_page(path, cache, id))
    }

    pub fn purge_page(&self, id: &str) -> Result<(), String> {
        purge_page(&self.path, id)
    }

    pub fn duplicate_page(&self, id: &str) -> Result<crate::cache::PageDetail, String> {
        self.with_cache_mut(|path, cache| duplicate_page(path, cache, id))
    }
}

pub fn find_by_id<'a>(workspaces: &'a [Workspace], id: &str) -> Option<&'a Workspace> {
    workspaces.iter().find(|workspace| workspace.id == id)
}

pub fn find_by_slug<'a>(workspaces: &'a [Workspace], slug: &str) -> Option<&'a Workspace> {
    workspaces
        .iter()
        .find(|workspace| workspace.settings.slug == slug)
}

pub fn discover_workspaces(dir: &Path) -> std::io::Result<Vec<Workspace>> {
    let mut workspaces = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        let workspace_json = path.join("workspace.json");
        if !workspace_json.is_file() {
            tracing::debug!(path = %log_path(&path), "skipping entry without workspace.json");
            continue;
        }

        let id = entry.file_name().to_string_lossy().into_owned();
        let contents = match fs::read_to_string(&workspace_json) {
            Ok(contents) => contents,
            Err(error) => {
                tracing::warn!(workspace = %id, %error, "skipping workspace: failed to read workspace.json");
                continue;
            }
        };

        let settings = match serde_json::from_str::<WorkspaceSettings>(&contents) {
            Ok(settings) => settings,
            Err(error) => {
                tracing::warn!(workspace = %id, %error, "skipping workspace: invalid workspace.json");
                continue;
            }
        };

        let runtime_dir = match ensure_runtime_dir(&path) {
            Ok(runtime_dir) => runtime_dir,
            Err(error) => {
                tracing::warn!(workspace = %id, %error, "skipping workspace: failed to create .fibbelous directory");
                continue;
            }
        };

        let cache = match CacheDb::open(&runtime_dir) {
            Ok(cache) => Arc::new(Mutex::new(cache)),
            Err(error) => {
                tracing::warn!(workspace = %id, %error, "skipping workspace: failed to open cache database");
                continue;
            }
        };

        tracing::info!(
            workspace = %id,
            name = %settings.name,
            runtime_dir = %log_path(&runtime_dir),
            "discovered workspace"
        );

        workspaces.push(Workspace {
            id,
            path,
            settings,
            cache,
            index_status: Arc::new(Mutex::new(IndexStatus::Pending)),
        });
    }

    workspaces.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(workspaces)
}

pub fn start_indexing(workspaces: Arc<Vec<Workspace>>) {
    for workspace in workspaces.iter().cloned() {
        tokio::spawn(index_workspace(workspace));
    }
}

async fn index_workspace(workspace: Workspace) {
    workspace.set_index_status(IndexStatus::Indexing);

    let workspace_id = workspace.id.clone();
    let path = workspace.path.clone();
    let cache = workspace.cache.clone();

    let result = tokio::task::spawn_blocking(move || -> Result<crate::index::SyncStats, String> {
        let mut cache = cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        sync_workspace(&path, &mut cache).map_err(|error| error.to_string())
    })
    .await;

    match result {
        Ok(Ok(stats)) => {
            workspace.set_index_status(IndexStatus::Ready);
            tracing::info!(
                workspace = %workspace_id,
                scanned = stats.scanned,
                updated = stats.updated,
                skipped = stats.skipped,
                removed = stats.removed,
                "indexed workspace"
            );
        }
        Ok(Err(error)) => {
            workspace.set_index_status(IndexStatus::Failed);
            tracing::warn!(workspace = %workspace_id, %error, "failed to index workspace");
        }
        Err(error) => {
            workspace.set_index_status(IndexStatus::Failed);
            tracing::warn!(workspace = %workspace_id, %error, "workspace indexing task failed");
        }
    }
}

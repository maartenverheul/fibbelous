use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::cache::{ensure_runtime_dir, CacheDb};
use crate::data::{log_fs_error, log_path};
use crate::databases;
use crate::flush::{self, spawn_flush, DirtyKey, FlushScheduler};
use crate::git::{self, GitStatus};
use crate::index::sync_workspace;
use crate::pages::{
    create_page, duplicate_page, get_trashed_page, list_trashed_pages, purge_page, restore_page,
    trash_page, update_page, CreatePageInput, UpdatePageInput,
};
use std::collections::HashSet;

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
    pub title: String,
    pub icon: String,
    pub created_at: String,
}

#[derive(Clone)]
pub struct Workspace {
    pub id: String,
    pub path: PathBuf,
    settings: Arc<Mutex<WorkspaceSettings>>,
    cache: Arc<Mutex<CacheDb>>,
    flush: FlushScheduler,
    index_status: Arc<Mutex<IndexStatus>>,
}

impl std::fmt::Debug for Workspace {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Workspace")
            .field("id", &self.id)
            .field("path", &self.path)
            .field("settings", &self.settings())
            .field("index_status", &self.index_status())
            .finish_non_exhaustive()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceRequest {
    pub title: String,
    pub slug: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneWorkspaceRequest {
    pub url: String,
    pub title: Option<String>,
    pub slug: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug)]
pub enum CreateWorkspaceError {
    Validation(String),
    SlugConflict,
    Io(std::io::Error),
}

impl From<std::io::Error> for CreateWorkspaceError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenWorkspaceRequest {
    pub path: String,
}

#[derive(Debug)]
pub enum OpenWorkspaceError {
    Validation(String),
    IdConflict,
    SlugConflict,
    Io(std::io::Error),
}

impl OpenWorkspaceError {
    pub fn message(&self) -> String {
        match self {
            Self::Validation(message) => message.clone(),
            Self::IdConflict => "workspace id already exists".to_owned(),
            Self::SlugConflict => "slug already exists".to_owned(),
            Self::Io(error) => error.to_string(),
        }
    }
}

impl From<std::io::Error> for OpenWorkspaceError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

#[derive(Debug)]
pub enum OpenWorkspaceOutcome {
    AlreadyLoaded(WorkspaceInfo),
    Opened(Workspace),
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkspaceRequest {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug)]
pub enum UpdateWorkspaceError {
    Validation(String),
    SlugConflict,
    NotFound,
    Io(std::io::Error),
}

impl From<std::io::Error> for UpdateWorkspaceError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub id: String,
    pub index_status: IndexStatus,
    #[serde(flatten)]
    pub settings: WorkspaceSettings,
}

impl Workspace {
    pub fn settings(&self) -> WorkspaceSettings {
        self.settings
            .lock()
            .expect("settings mutex poisoned")
            .clone()
    }

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
            settings: self.settings(),
        }
    }

    fn reload_settings(&self) -> Result<(), String> {
        let workspace_json = self.path.join("workspace.json");
        let contents = fs::read_to_string(&workspace_json).map_err(|error| error.to_string())?;
        let settings = serde_json::from_str::<WorkspaceSettings>(&contents).map_err(|error| {
            format!(
                "invalid workspace.json ({error}). Expected fields: title, slug, icon, createdAt"
            )
        })?;
        *self
            .settings
            .lock()
            .expect("settings mutex poisoned") = settings;
        Ok(())
    }

    pub fn list_pages(
        &self,
        parent_id: Option<&str>,
        depth: u8,
    ) -> Result<Vec<crate::cache::PageSummary>, String> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        cache
            .list_pages_by_parent(parent_id, depth)
            .map_err(|error| error.to_string())
    }

    pub fn list_favorite_pages(&self) -> Result<Vec<crate::cache::PageSummary>, String> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        cache
            .list_favorite_pages()
            .map_err(|error| error.to_string())
    }

    pub fn get_page(&self, id: &str) -> Result<Option<crate::cache::PageDetail>, String> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;

        if let Some(page) = cache
            .get_page_by_id(id)
            .map_err(|error| error.to_string())?
        {
            return Ok(Some(page));
        }

        let Some(row) = cache
            .get_database_row_by_id(id)
            .map_err(|error| error.to_string())?
        else {
            return databases::find_database_template(&cache, id);
        };

        let content = cache
            .get_database_row_content(id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "database row content not found".to_owned())?;
        let (created, edited, attributes_json) =
            crate::cache::parse_row_cache_fields(&content);
        let attributes = serde_json::from_str(&attributes_json)
            .unwrap_or_else(|_| serde_json::json!({}));
        let body = crate::cache::page_body_from_content(&content);
        let body_hash = crate::cache::hash_body(&body);
        let referenced_pages = cache
            .referenced_pages_for_body(&body)
            .map_err(|error| error.to_string())?;

        let mut ancestors = Vec::new();
        if let Some(host) = cache
            .get_page_by_id(&row.database_id)
            .map_err(|error| error.to_string())?
        {
            ancestors = host.ancestors;
            // Host page itself as the last ancestor (without its body).
            ancestors.push(crate::cache::PageSummary {
                id: host.id,
                parent_id: host.parent_id,
                slug: host.slug,
                title: host.title,
                icon: host.icon,
                path: host.path,
                has_children: host.has_children,
                favorite: host.favorite,
                database_id: None,
                children: None,
            });
        }

        Ok(Some(crate::cache::PageDetail {
            id: row.id,
            parent_id: None,
            slug: row.slug,
            title: row.title,
            icon: row.icon,
            path: row.path,
            has_children: false,
            favorite: row.favorite,
            database_id: Some(row.database_id),
            is_database_template: false,
            attributes: Some(attributes),
            created: created.or(row.created),
            edited: edited.or(row.edited),
            body,
            body_hash,
            referenced_pages,
            ancestors,
        }))
    }

    pub fn get_database(&self, id: &str) -> Result<Option<crate::cache::DatabaseDetail>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        match databases::get_database(&self.path, &mut cache, id) {
            Ok(Some((detail, dirty))) => {
                if dirty {
                    self.flush.mark(DirtyKey::Database(id.to_owned()));
                }
                Ok(Some(detail))
            }
            Ok(None) => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub fn list_database_rows(
        &self,
        id: &str,
        limit: Option<usize>,
        offset: Option<usize>,
        sort: Option<crate::databases::DatabaseViewSort>,
    ) -> Result<Option<crate::cache::DatabaseRowsPage>, String> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        databases::list_database_rows(&self.path, &cache, id, limit, offset, sort)
    }

    pub fn update_database_view(
        &self,
        database_id: &str,
        view_id: &str,
        update: crate::databases::DatabaseViewUpdate,
    ) -> Result<Option<crate::cache::DatabaseDetail>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result =
            databases::update_database_view(&self.path, &mut cache, database_id, view_id, update);
        if matches!(result, Ok(Some(_))) {
            self.flush.mark(DirtyKey::Database(database_id.to_owned()));
        }
        result
    }

    pub fn create_database_view(
        &self,
        database_id: &str,
        input: crate::databases::CreateDatabaseViewInput,
    ) -> Result<Option<crate::databases::CreateDatabaseViewResult>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result =
            databases::create_database_view(&self.path, &mut cache, database_id, input);
        if matches!(result, Ok(Some(_))) {
            self.flush.mark(DirtyKey::Database(database_id.to_owned()));
        }
        result
    }

    pub fn delete_database_view(
        &self,
        database_id: &str,
        view_id: &str,
    ) -> Result<Option<crate::cache::DatabaseDetail>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result =
            databases::delete_database_view(&self.path, &mut cache, database_id, view_id);
        if matches!(result, Ok(Some(_))) {
            self.flush.mark(DirtyKey::Database(database_id.to_owned()));
        }
        result
    }

    pub fn create_database_row(
        &self,
        database_id: &str,
        title: Option<String>,
        template_id: Option<String>,
    ) -> Result<crate::cache::PageDetail, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result = databases::create_database_row(
            &self.path,
            &mut cache,
            database_id,
            title,
            template_id,
        );
        if let Ok(page) = &result {
            self.flush.mark(DirtyKey::Row(page.id.clone()));
        }
        result
    }

    pub fn create_database_template(
        &self,
        database_id: &str,
    ) -> Result<Option<databases::CreateDatabaseTemplateResult>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result =
            databases::create_database_template(&self.path, &mut cache, database_id);
        if matches!(result, Ok(Some(_))) {
            self.flush.mark(DirtyKey::Database(database_id.to_owned()));
        }
        result
    }

    pub fn get_database_template(
        &self,
        database_id: &str,
        template_id: &str,
    ) -> Result<Option<crate::cache::PageDetail>, String> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        databases::get_database_template(&self.path, &cache, database_id, template_id)
    }

    pub fn update_database_template(
        &self,
        database_id: &str,
        template_id: &str,
        update: databases::UpdateDatabaseTemplateInput,
    ) -> Result<Option<crate::cache::PageDetail>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result = databases::update_database_template(
            &self.path,
            &mut cache,
            database_id,
            template_id,
            update,
        );
        if matches!(result, Ok(Some(_))) {
            self.flush.mark(DirtyKey::Database(database_id.to_owned()));
        }
        result
    }

    pub fn duplicate_database_template(
        &self,
        database_id: &str,
        template_id: &str,
    ) -> Result<Option<databases::DuplicateDatabaseTemplateResult>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result = databases::duplicate_database_template(
            &self.path,
            &mut cache,
            database_id,
            template_id,
        );
        if matches!(result, Ok(Some(_))) {
            self.flush.mark(DirtyKey::Database(database_id.to_owned()));
        }
        result
    }

    pub fn delete_database_template(
        &self,
        database_id: &str,
        template_id: &str,
    ) -> Result<Option<crate::cache::DatabaseDetail>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result = databases::delete_database_template(
            &self.path,
            &mut cache,
            database_id,
            template_id,
        );
        if matches!(result, Ok(Some(_))) {
            self.flush.mark(DirtyKey::Database(database_id.to_owned()));
        }
        result
    }

    pub fn set_default_database_template(
        &self,
        database_id: &str,
        template_id: &str,
    ) -> Result<Option<crate::cache::DatabaseDetail>, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result = databases::set_default_database_template(
            &self.path,
            &mut cache,
            database_id,
            template_id,
        );
        if matches!(result, Ok(Some(_))) {
            self.flush.mark(DirtyKey::Database(database_id.to_owned()));
        }
        result
    }

    pub fn list_databases(&self) -> Result<Vec<crate::cache::DatabaseMeta>, String> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        databases::list_databases(&cache)
    }

    pub fn create_database(
        &self,
        title: Option<String>,
        parent_id: Option<String>,
    ) -> Result<databases::CreateDatabaseResult, String> {
        let mut cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        let result = databases::create_database(&self.path, &mut cache, title, parent_id);
        if let Ok(created) = &result {
            self.flush
                .mark(DirtyKey::Database(created.database.id.clone()));
            if let Some(page) = &created.page {
                self.flush.mark(DirtyKey::Page(page.id.clone()));
            }
        }
        result
    }

    pub fn search_pages(
        &self,
        query: &str,
        limit: Option<usize>,
    ) -> Result<Vec<crate::cache::SearchPageHit>, String> {
        let cache = self
            .cache
            .lock()
            .map_err(|_| "cache mutex poisoned".to_string())?;
        cache
            .search_pages(query, limit.unwrap_or(50))
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
        let result = self.with_cache_mut(|path, cache| create_page(path, cache, input));
        if let Ok(page) = &result {
            self.flush.mark(DirtyKey::Page(page.id.clone()));
        }
        result
    }

    pub fn update_page(&self, input: UpdatePageInput) -> Result<crate::cache::PageDetail, String> {
        let result = self.with_cache_mut(|path, cache| update_page(path, cache, input));
        match result {
            Ok((page, old_path)) => {
                self.flush.mark(if page.database_id.is_some() {
                    DirtyKey::Row(page.id.clone())
                } else {
                    DirtyKey::Page(page.id.clone())
                });
                if let Some(old_path) = old_path {
                    self.flush.mark_delete(old_path);
                }
                Ok(page)
            }
            Err(error) => Err(error),
        }
    }

    pub fn trash_page(&self, id: &str) -> Result<Vec<String>, String> {
        self.with_cache_mut(|path, cache| trash_page(path, cache, id))
    }

    pub fn list_trashed_pages(&self) -> Result<Vec<crate::pages::TrashedPageSummary>, String> {
        list_trashed_pages(&self.path)
    }

    pub fn get_trashed_page(
        &self,
        id: &str,
    ) -> Result<Option<crate::pages::TrashedPageDetail>, String> {
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
        let (updated_pages, updated_rows) =
            self.with_cache_mut(|path, cache| purge_page(path, cache, id))?;
        for page_id in updated_pages {
            self.flush.mark(DirtyKey::Page(page_id));
        }
        for row_id in updated_rows {
            self.flush.mark(DirtyKey::Row(row_id));
        }
        Ok(())
    }

    pub fn duplicate_page(&self, id: &str) -> Result<crate::cache::PageDetail, String> {
        let result = self.with_cache_mut(|path, cache| duplicate_page(path, cache, id));
        if let Ok(page) = &result {
            self.flush.mark(DirtyKey::Page(page.id.clone()));
        }
        result
    }

    /// Rescan workspace files and update the cache for pages that changed on disk
    /// (same incremental sync path as startup indexing). Also reloads `workspace.json`.
    pub fn reindex(&self) -> Result<crate::index::SyncStats, String> {
        self.set_index_status(IndexStatus::Indexing);
        tracing::info!(
            workspace = %self.id,
            path = %log_path(&self.path),
            "reindexing workspace"
        );

        if let Err(error) = self.reload_settings() {
            self.set_index_status(IndexStatus::Failed);
            tracing::warn!(
                workspace = %self.id,
                %error,
                "failed to reload workspace.json during reindex"
            );
            return Err(error);
        }

        let result = self.with_cache_mut(|path, cache| {
            sync_workspace(path, cache).map_err(|error| error.to_string())
        });

        match &result {
            Ok(stats) => {
                self.set_index_status(IndexStatus::Ready);
                tracing::info!(
                    workspace = %self.id,
                    scanned = stats.scanned,
                    updated = stats.updated,
                    skipped = stats.skipped,
                    removed = stats.removed,
                    "reindexed workspace"
                );
            }
            Err(error) => {
                self.set_index_status(IndexStatus::Failed);
                tracing::warn!(workspace = %self.id, %error, "failed to reindex workspace");
            }
        }

        result
    }

    fn persist_settings(&self) -> Result<(), std::io::Error> {
        let contents = serde_json::to_string_pretty(&self.settings()).map_err(|error| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("failed to serialize workspace.json: {error}"),
            )
        })?;
        let path = self.path.join("workspace.json");
        fs::write(&path, contents).inspect_err(|error| log_fs_error(&path, "write", error))
    }

    pub fn update_settings(
        &mut self,
        all_workspaces: &[Workspace],
        input: UpdateWorkspaceRequest,
    ) -> Result<WorkspaceInfo, UpdateWorkspaceError> {
        let mut settings = self
            .settings
            .lock()
            .expect("settings mutex poisoned");

        if let Some(title) = input.title {
            let title = title.trim().to_owned();
            if title.is_empty() {
                return Err(UpdateWorkspaceError::Validation(
                    "title is required".to_owned(),
                ));
            }
            settings.title = title;
        }

        if let Some(slug) = input.slug {
            let slug = slugify(&slug);
            if slug.is_empty() {
                return Err(UpdateWorkspaceError::Validation(
                    "slug is required".to_owned(),
                ));
            }
            if all_workspaces
                .iter()
                .any(|workspace| workspace.id != self.id && workspace.settings().slug == slug)
            {
                return Err(UpdateWorkspaceError::SlugConflict);
            }
            settings.slug = slug;
        }

        if let Some(icon) = input.icon {
            settings.icon = icon;
        }

        drop(settings);
        self.persist_settings()?;
        Ok(self.info())
    }

    pub fn flush_to_disk(&self) -> Result<(), String> {
        flush::flush_pending(&self.path, &self.cache, &HashSet::new())
    }

    pub fn ensure_git(&self) -> Result<(), String> {
        self.flush_to_disk()?;
        if !git::is_git_repo(&self.path) {
            tracing::info!(
                workspace = %self.id,
                path = %log_path(&self.path),
                "initializing git repository"
            );
            git::init_repo(&self.path)?;
            git::commit_daily(&self.path)?;
            return Ok(());
        }
        git::ensure_repo_with_commit(&self.path)
    }

    pub fn git_status(&self) -> Result<GitStatus, String> {
        tracing::debug!(workspace = %self.id, "git status starting");
        self.ensure_git()?;
        self.flush_to_disk()?;
        let status = git::status(&self.path)?;
        tracing::debug!(
            workspace = %self.id,
            branch = %status.branch,
            ahead = status.ahead,
            behind = status.behind,
            files = status.files.len(),
            "git status finished"
        );
        Ok(status)
    }

    pub fn git_commit(&self) -> Result<GitStatus, String> {
        tracing::info!(workspace = %self.id, "git commit starting");
        self.ensure_git()?;
        self.flush_to_disk()?;
        match git::commit_daily(&self.path) {
            Ok(status) => {
                tracing::info!(
                    workspace = %self.id,
                    branch = %status.branch,
                    commit_title = %status.commit_title,
                    files = status.files.len(),
                    "git commit finished"
                );
                Ok(status)
            }
            Err(error) => {
                tracing::warn!(workspace = %self.id, %error, "git commit failed");
                Err(error)
            }
        }
    }

    pub fn git_push(&self) -> Result<GitStatus, String> {
        tracing::info!(workspace = %self.id, "git push starting");
        self.ensure_git()?;
        self.flush_to_disk()?;
        match git::push(&self.path) {
            Ok(status) => {
                tracing::info!(
                    workspace = %self.id,
                    branch = %status.branch,
                    upstream = ?status.upstream,
                    ahead = status.ahead,
                    behind = status.behind,
                    "git push finished"
                );
                Ok(status)
            }
            Err(error) => {
                tracing::warn!(workspace = %self.id, %error, "git push failed");
                Err(error)
            }
        }
    }

    pub fn git_pull(&self) -> Result<GitStatus, String> {
        tracing::info!(workspace = %self.id, "git pull starting");
        self.ensure_git()?;
        self.flush_to_disk()?;
        match git::pull(&self.path) {
            Ok(status) => {
                tracing::info!(
                    workspace = %self.id,
                    branch = %status.branch,
                    upstream = ?status.upstream,
                    ahead = status.ahead,
                    behind = status.behind,
                    "git pull finished"
                );
                Ok(status)
            }
            Err(error) => {
                tracing::warn!(workspace = %self.id, %error, "git pull failed");
                Err(error)
            }
        }
    }
}

pub fn find_by_id<'a>(workspaces: &'a [Workspace], id: &str) -> Option<&'a Workspace> {
    workspaces.iter().find(|workspace| workspace.id == id)
}

pub fn find_by_id_mut<'a>(workspaces: &'a mut [Workspace], id: &str) -> Option<&'a mut Workspace> {
    workspaces.iter_mut().find(|workspace| workspace.id == id)
}

pub fn find_by_slug<'a>(workspaces: &'a [Workspace], slug: &str) -> Option<&'a Workspace> {
    workspaces
        .iter()
        .find(|workspace| workspace.settings().slug == slug)
}

fn slugify(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn generate_workspace_id(salt: &str) -> String {
    let mut hasher = DefaultHasher::new();
    SystemTime::now().hash(&mut hasher);
    salt.hash(&mut hasher);
    format!("{:08x}", hasher.finish() as u32)
}

fn unique_workspace_id(workspaces_dir: &Path, salt: &str) -> String {
    loop {
        let id = generate_workspace_id(salt);
        if !workspaces_dir.join(&id).exists() {
            return id;
        }
    }
}

fn now_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn open_workspace(id: String, path: PathBuf) -> Result<Workspace, String> {
    let workspace_json = path.join("workspace.json");
    if !workspace_json.is_file() {
        return Err("missing workspace.json".to_owned());
    }

    let contents = fs::read_to_string(&workspace_json).map_err(|error| error.to_string())?;
    let settings = serde_json::from_str::<WorkspaceSettings>(&contents).map_err(|error| {
        format!("invalid workspace.json ({error}). Expected fields: title, slug, icon, createdAt")
    })?;

    let runtime_dir = ensure_runtime_dir(&path).map_err(|error| error.to_string())?;
    let cache = CacheDb::open(&runtime_dir).map_err(|error| error.to_string())?;

    Ok(Workspace {
        id,
        path,
        settings: Arc::new(Mutex::new(settings)),
        cache: Arc::new(Mutex::new(cache)),
        flush: FlushScheduler::new(),
        index_status: Arc::new(Mutex::new(IndexStatus::Pending)),
    })
}

fn seed_welcome_page(workspace: &Workspace) -> Result<(), String> {
    workspace.create_page(CreatePageInput {
        id: None,
        parent_id: None,
        title: Some("Welcome".to_owned()),
        slug: Some("welcome".to_owned()),
        icon: None,
        body: Some("# Welcome\n\nThis is your first page. Start writing here.".to_owned()),
        favorite: false,
    })?;
    Ok(())
}

fn initialize_workspace_at_path(
    path: &Path,
    id: String,
    title: String,
    slug: String,
    icon: String,
) -> Result<Workspace, String> {
    fs::create_dir_all(path).map_err(|error| {
        log_fs_error(path, "create_dir_all", &error);
        error.to_string()
    })?;
    let pages_dir = path.join("pages");
    fs::create_dir_all(&pages_dir).map_err(|error| {
        log_fs_error(&pages_dir, "create_dir_all", &error);
        error.to_string()
    })?;

    let settings = WorkspaceSettings {
        slug: slug.clone(),
        title: title.clone(),
        icon,
        created_at: now_timestamp(),
    };

    let workspace_json = path.join("workspace.json");
    let contents = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("failed to serialize workspace.json: {error}"))?;
    fs::write(&workspace_json, contents).map_err(|error| {
        log_fs_error(&workspace_json, "write", &error);
        error.to_string()
    })?;

    let workspace = open_workspace(id, path.to_path_buf())?;
    seed_welcome_page(&workspace)?;
    workspace.flush_to_disk()?;
    git::init_repo(&workspace.path)?;
    git::commit_daily(&workspace.path)?;

    tracing::info!(
        workspace = %workspace.id,
        title = %workspace.settings().title,
        slug = %workspace.settings().slug,
        path = %log_path(path),
        "created workspace"
    );

    Ok(workspace)
}

fn paths_equal(a: &Path, b: &Path) -> bool {
    if a == b {
        return true;
    }
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn folder_name(path: &Path) -> Option<String> {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .filter(|name| !name.is_empty())
}

pub fn create_workspace(
    workspaces_dir: &Path,
    existing: &[Workspace],
    input: CreateWorkspaceRequest,
) -> Result<Workspace, CreateWorkspaceError> {
    let title = input.title.trim().to_owned();
    if title.is_empty() {
        return Err(CreateWorkspaceError::Validation(
            "title is required".to_owned(),
        ));
    }

    let slug = input
        .slug
        .map(|value| slugify(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| slugify(&title));

    if slug.is_empty() {
        return Err(CreateWorkspaceError::Validation(
            "slug is required".to_owned(),
        ));
    }

    if existing
        .iter()
        .any(|workspace| workspace.settings().slug == slug)
    {
        return Err(CreateWorkspaceError::SlugConflict);
    }

    let icon = input.icon.unwrap_or_default();
    let id = unique_workspace_id(workspaces_dir, &format!("{title}:{slug}"));
    let path = workspaces_dir.join(&id);

    initialize_workspace_at_path(&path, id, title, slug, icon).map_err(|error| {
        CreateWorkspaceError::Validation(format!("failed to create workspace: {error}"))
    })
}

pub fn clone_workspace(
    workspaces_dir: &Path,
    existing: &[Workspace],
    input: CloneWorkspaceRequest,
) -> Result<Workspace, CreateWorkspaceError> {
    let url = input.url.trim().to_owned();
    if url.is_empty() {
        return Err(CreateWorkspaceError::Validation(
            "url is required".to_owned(),
        ));
    }

    let id = unique_workspace_id(workspaces_dir, &url);
    let path = workspaces_dir.join(&id);

    git::clone_repo(&url, &path).map_err(CreateWorkspaceError::Validation)?;

    if path.join("workspace.json").is_file() {
        let workspace =
            open_workspace(id, path).map_err(CreateWorkspaceError::Validation)?;
        if existing
            .iter()
            .any(|item| item.settings().slug == workspace.settings().slug)
        {
            let _ = fs::remove_dir_all(&workspace.path);
            return Err(CreateWorkspaceError::SlugConflict);
        }
        workspace
            .ensure_git()
            .map_err(CreateWorkspaceError::Validation)?;
        return Ok(workspace);
    }

    let folder = git::folder_name_from_url(&url);
    let title = input
        .title
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| folder.clone());
    let slug = input
        .slug
        .map(|value| slugify(&value))
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| slugify(&title));
    if slug.is_empty() {
        let _ = fs::remove_dir_all(&path);
        return Err(CreateWorkspaceError::Validation(
            "slug is required".to_owned(),
        ));
    }
    if existing
        .iter()
        .any(|workspace| workspace.settings().slug == slug)
    {
        let _ = fs::remove_dir_all(&path);
        return Err(CreateWorkspaceError::SlugConflict);
    }

    let icon = input.icon.unwrap_or_default();
    let settings = WorkspaceSettings {
        slug: slug.clone(),
        title: title.clone(),
        icon,
        created_at: now_timestamp(),
    };
    let contents = serde_json::to_string_pretty(&settings).map_err(|error| {
        CreateWorkspaceError::Validation(format!("failed to serialize workspace.json: {error}"))
    })?;
    let workspace_json = path.join("workspace.json");
    fs::write(&workspace_json, contents)
        .inspect_err(|error| log_fs_error(&workspace_json, "write", error))?;
    let pages_dir = path.join("pages");
    fs::create_dir_all(&pages_dir)
        .inspect_err(|error| log_fs_error(&pages_dir, "create_dir_all", error))?;

    let workspace = open_workspace(id, path).map_err(CreateWorkspaceError::Validation)?;
    workspace
        .ensure_git()
        .map_err(CreateWorkspaceError::Validation)?;

    tracing::info!(
        workspace = %workspace.id,
        title = %workspace.settings().title,
        path = %log_path(&workspace.path),
        "cloned workspace"
    );

    Ok(workspace)
}

/// Clone a git URL into `parent_dir/<repo-name>` and open it as a local workspace.
pub fn clone_workspace_to_parent(
    existing: &[Workspace],
    url: &str,
    parent_dir: &Path,
) -> Result<Workspace, OpenWorkspaceError> {
    let url = url.trim();
    if url.is_empty() {
        return Err(OpenWorkspaceError::Validation(
            "url is required".to_owned(),
        ));
    }
    if !parent_dir.is_dir() {
        return Err(OpenWorkspaceError::Validation(
            "parent path must be a directory".to_owned(),
        ));
    }

    let dest = git::clone_dest_in_parent(parent_dir, url);
    git::clone_repo(url, &dest).map_err(OpenWorkspaceError::Validation)?;

    if !dest.join("workspace.json").is_file() {
        let folder = git::folder_name_from_url(url);
        let slug = slugify(&folder);
        if slug.is_empty() {
            let _ = fs::remove_dir_all(&dest);
            return Err(OpenWorkspaceError::Validation(
                "repository name must produce a valid slug".to_owned(),
            ));
        }
        let settings = WorkspaceSettings {
            slug,
            title: folder,
            icon: String::new(),
            created_at: now_timestamp(),
        };
        let contents = serde_json::to_string_pretty(&settings).map_err(|error| {
            OpenWorkspaceError::Validation(format!("failed to serialize workspace.json: {error}"))
        })?;
        let workspace_json = dest.join("workspace.json");
        fs::write(&workspace_json, contents)
            .inspect_err(|error| log_fs_error(&workspace_json, "write", error))
            .map_err(OpenWorkspaceError::Io)?;
        let pages_dir = dest.join("pages");
        fs::create_dir_all(&pages_dir)
            .inspect_err(|error| log_fs_error(&pages_dir, "create_dir_all", error))
            .map_err(OpenWorkspaceError::Io)?;
    }

    match open_workspace_at_path(existing, &dest.to_string_lossy())? {
        OpenWorkspaceOutcome::AlreadyLoaded(info) => existing
            .iter()
            .find(|workspace| workspace.id == info.id)
            .cloned()
            .ok_or_else(|| {
                OpenWorkspaceError::Validation("cloned workspace not found".to_owned())
            }),
        OpenWorkspaceOutcome::Opened(workspace) => Ok(workspace),
    }
}

pub fn open_workspace_at_path(
    existing: &[Workspace],
    path_input: &str,
) -> Result<OpenWorkspaceOutcome, OpenWorkspaceError> {
    let trimmed = path_input.trim();
    if trimmed.is_empty() {
        return Err(OpenWorkspaceError::Validation(
            "path is required".to_owned(),
        ));
    }

    let path = PathBuf::from(trimmed);
    if path.exists() && !path.is_dir() {
        return Err(OpenWorkspaceError::Validation(
            "path must be a directory".to_owned(),
        ));
    }

    if let Some(loaded) = existing
        .iter()
        .find(|workspace| paths_equal(&workspace.path, &path))
    {
        return Ok(OpenWorkspaceOutcome::AlreadyLoaded(loaded.info()));
    }

    let id = folder_name(&path).ok_or_else(|| {
        OpenWorkspaceError::Validation("path must include a folder name".to_owned())
    })?;

    if existing.iter().any(|workspace| workspace.id == id) {
        return Err(OpenWorkspaceError::IdConflict);
    }

    if path.join("workspace.json").is_file() {
        let workspace = open_workspace(id, path).map_err(OpenWorkspaceError::Validation)?;

        if existing
            .iter()
            .any(|item| item.settings().slug == workspace.settings().slug)
        {
            return Err(OpenWorkspaceError::SlugConflict);
        }

        if let Err(error) = workspace.ensure_git() {
            tracing::warn!(
                workspace = %workspace.id,
                %error,
                "failed to ensure git repository for workspace"
            );
            return Err(OpenWorkspaceError::Validation(error));
        }

        tracing::info!(
            workspace = %workspace.id,
            title = %workspace.settings().title,
            path = %log_path(&workspace.path),
            "opened workspace from path"
        );

        return Ok(OpenWorkspaceOutcome::Opened(workspace));
    }

    if path.exists() {
        let is_empty = fs::read_dir(&path)?.next().is_none();
        if !is_empty {
            return Err(OpenWorkspaceError::Validation(
                "folder is not empty and has no workspace.json".to_owned(),
            ));
        }
    }

    let title = id.clone();
    let slug = slugify(&title);
    if slug.is_empty() {
        return Err(OpenWorkspaceError::Validation(
            "folder name must produce a valid slug".to_owned(),
        ));
    }

    if existing
        .iter()
        .any(|workspace| workspace.settings().slug == slug)
    {
        return Err(OpenWorkspaceError::SlugConflict);
    }

    let workspace = initialize_workspace_at_path(&path, id, title, slug, String::new())
        .map_err(OpenWorkspaceError::Validation)?;

    Ok(OpenWorkspaceOutcome::Opened(workspace))
}

pub fn discover_workspaces(dir: &Path) -> std::io::Result<Vec<Workspace>> {
    let mut workspaces = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if !path.is_dir() {
            continue;
        }

        if !path.join("workspace.json").is_file() {
            tracing::debug!(path = %log_path(&path), "skipping entry without workspace.json");
            continue;
        }

        let id = entry.file_name().to_string_lossy().into_owned();
        match open_workspace(id, path.clone()) {
            Ok(workspace) => {
                if let Err(error) = workspace.ensure_git() {
                    tracing::warn!(path = %log_path(&path), %error, "skipping workspace without git");
                    continue;
                }
                tracing::info!(
                    workspace = %workspace.id,
                    title = %workspace.settings().title,
                    "discovered workspace"
                );
                workspaces.push(workspace);
            }
            Err(error) => {
                tracing::warn!(path = %log_path(&path), %error, "skipping workspace");
            }
        }
    }

    workspaces.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(workspaces)
}

pub fn spawn_indexing(workspace: Workspace) {
    spawn_flush(
        workspace.path.clone(),
        workspace.cache.clone(),
        workspace.flush.clone(),
    );
    tokio::spawn(index_workspace(workspace));
}

pub fn start_indexing(workspaces: &[Workspace]) {
    tracing::info!(count = workspaces.len(), "starting workspace indexing");
    for workspace in workspaces {
        spawn_indexing(workspace.clone());
    }
}

async fn index_workspace(workspace: Workspace) {
    workspace.set_index_status(IndexStatus::Indexing);

    let workspace_id = workspace.id.clone();
    let path = workspace.path.clone();
    let cache = workspace.cache.clone();

    tracing::info!(
        workspace = %workspace_id,
        path = %log_path(&path),
        "indexing workspace"
    );

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

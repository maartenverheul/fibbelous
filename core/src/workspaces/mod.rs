// use crate::time::now_rfc3339_seconds; // no longer needed after switching to DateTime<Utc>
use crate::pages::{Page, PageManager};
use crate::{id::generate_hex_id, indexing::init_index_db};
use chrono::{DateTime, Utc};
use git2::Repository;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Error, ErrorKind};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::{debug, error, info};

pub use crate::icon::normalize_icon;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewWorkspace {
    pub slug: String,
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceConnection {
    pub id: String,
    pub path: Option<PathBuf>,
    pub url: Option<String>,
    pub git: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub id: String,
    pub slug: String,
    pub title: String,
    pub icon: Option<String>,
    pub description: Option<String>,
    // RFC3339 seconds precision via custom serializer
    #[serde(with = "crate::time::serde_rfc3339_secs")]
    pub created_at: DateTime<Utc>,
    pub version: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceRequest {
    pub slug: String,
    pub title: String,
    pub icon: Option<String>,
    pub description: Option<String>,
}

/// Represents a fully initialized workspace (metadata + its index database handle)
#[derive(Debug)]
pub struct LoadedWorkspace {
    pub id: String,
    pub path: PathBuf,
    pub connection: WorkspaceConnection,
    pub info: WorkspaceInfo,
    pub db: DatabaseConnection,

    pub page_manager: Arc<PageManager>,
    pub events_tx: broadcast::Sender<crate::events::Event>,
}

impl WorkspaceInfo {
    pub fn default_workspace() -> Self {
        let created_at = Utc::now();
        Self {
            id: generate_hex_id(),
            slug: "default".to_string(),
            title: "Default workspace".to_string(),
            icon: Some("📁".to_string()),
            description: Some("The default workspace".to_string()),
            created_at,
            version: 1,
        }
    }
}

pub struct WorkspaceManager {
    pub std_dir: PathBuf,
    pub list: HashMap<String, Arc<LoadedWorkspace>>,
}

impl WorkspaceManager {
    pub fn new(path: PathBuf) -> Self {
        Self {
            std_dir: path,
            list: HashMap::new(),
        }
    }

    pub fn get(&self, id: &str) -> Option<Arc<LoadedWorkspace>> {
        return self.list.get(id).cloned();
    }

    pub async fn load_std(&mut self) -> &mut Self {
        let loaded: Vec<LoadedWorkspace> = self.scan_std().await;
        let mut workspaces_map: HashMap<String, Arc<LoadedWorkspace>> = HashMap::new();
        for w in loaded {
            workspaces_map.insert(w.id.clone(), Arc::new(w));
        }

        self.list = workspaces_map;

        self
    }

    /// Load and initialize all workspaces found under the workspace root directory.
    /// Returns a Vec instead of a HashMap so callers can decide how to structure state.
    pub async fn scan_std(&self) -> Vec<LoadedWorkspace> {
        let mut result = Vec::new();
        let dirs = match self.workspace_dirs() {
            Ok(d) => d,
            Err(e) => {
                error!("Failed to list workspace directories: {}", e);
                return result;
            }
        };
        info!("Found {} workspace directories", dirs.len());
        for dir in dirs.iter() {
            info!("Loading workspace from \"{}\"", dir.display());
            match WorkspaceManager::load_workspace_from_dir(dir.clone()).await {
                Ok(loaded) => {
                    result.push(loaded);
                }
                Err(err) => {
                    error!("Workspace failed to load: {}", err);
                    continue;
                }
            }
        }
        info!(
            "Succesfully loaded {}/{} workspaces",
            result.len(),
            dirs.len()
        );
        result
    }

    pub fn workspace_dirs(&self) -> Result<Vec<std::path::PathBuf>, Error> {
        let mut dirs = Vec::new();
        let read_dir = std::fs::read_dir(&self.std_dir);
        match read_dir {
            Ok(entries) => {
                for entry in entries {
                    let entry = entry?;
                    let path = entry.path();
                    if path.is_dir() && path.join(".git").is_dir() {
                        dirs.push(path);
                    }
                }
                Ok(dirs)
            }
            Err(e) => {
                error!(
                    "Failed to read workspace directory '{}': {}",
                    self.std_dir.display(),
                    e
                );
                Err(e)
            }
        }
    }

    pub async fn create_default(
        &self,
        target_path: Option<&Path>,
    ) -> Result<LoadedWorkspace, git2::Error> {
        self.create(WorkspaceInfo::default_workspace(), target_path)
            .await
    }

    pub async fn create(
        &self,
        mut settings: WorkspaceInfo,
        target_path: Option<&Path>,
    ) -> Result<LoadedWorkspace, git2::Error> {
        // Clone and normalize icon via helper
        settings.icon = normalize_icon(&settings.icon);

        let repo_path: PathBuf = match target_path {
            Some(p) => p.to_path_buf(),
            None => self.std_dir.join(&settings.id),
        };
        info!(
            "Creating workspace {:?} with id {:?} at {:?}",
            settings.slug, settings.id, repo_path
        );

        // Init repo
        debug!("Initializing git repo");
        match Repository::init(&repo_path) {
            Ok(_) => (),
            Err(e) => panic!("failed to init: {}", e),
        };

        // Fill repo
        self.write_workspace_info(&repo_path, &settings)
            .expect("Failed to write workspace info");
        self.create_workspace_directories(&repo_path)
            .expect("Failed to create workspace directories");
        let fib = self
            .ensure_fibbelous_folder(&repo_path)
            .expect("Failed to create .fibbelous folder");

        // Always create one default page.
        let page_manager = Arc::new(PageManager::new(repo_path.clone(), settings.slug.clone()));
        // No need to index here

        let page = Page::default(None);
        page_manager
            .save_page(&page)
            .await
            .expect("Failed to create default page");

        let db = init_index_db(&fib).await.expect("Failed to init index DB");

        let connection = WorkspaceConnection {
            id: settings.id.clone(),
            path: Some(repo_path.clone()),
            url: None,
            git: None,
        };

        let loaded = LoadedWorkspace {
            id: settings.id.clone(),
            path: repo_path.clone(),
            connection,
            info: settings.clone(),
            db,

            page_manager,
            events_tx: broadcast::channel(100).0,
        };

        // self.workspaces
        //     .write()
        //     .await
        //     .insert(loaded.id.clone(), &loaded);

        Ok(loaded)
    }

    /// High-level helper: create a workspace from a request, writing its metadata, initializing git repo
    /// and preparing / initializing its index database. Returns a fully loaded workspace.
    pub async fn create_workspace_from_request(
        &self,
        req: CreateWorkspaceRequest,
    ) -> Result<LoadedWorkspace, String> {
        let info = WorkspaceInfo {
            id: generate_hex_id(),
            slug: req.slug,
            title: req.title,
            icon: req.icon,
            description: req.description,
            created_at: Utc::now(),
            version: 1,
        };

        let state = self
            .create(info, None)
            .await
            .expect("Failed to create workspace");

        Ok(state)
    }

    fn create_workspace_directories(&self, base_path: &Path) -> Result<(), Error> {
        debug!("Creating workspace directories");
        let dirs = ["pages", "databases", "content"];
        for dir in dirs.iter() {
            let dir_path = base_path.join(dir);
            if !dir_path.exists() {
                std::fs::create_dir_all(&dir_path)?;
            }
        }
        Ok(())
    }

    pub fn write_workspace_info(&self, path: &Path, info: &WorkspaceInfo) -> Result<(), Error> {
        debug!("Writing workspace info");
        let json = serde_json::to_string_pretty(info)?;
        std::fs::write(path.join("workspace.json"), json)?;
        Ok(())
    }

    fn ensure_fibbelous_folder(&self, path: &Path) -> Result<PathBuf, Error> {
        debug!("Ensuring/creating .fibbelous folder");
        let app_dir = path.join(".fibbelous");
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir)?;
        }
        let gi_path = app_dir.join(".gitignore");
        if !gi_path.exists() {
            let gi_contents = "*\n";
            std::fs::write(&gi_path, gi_contents)?;
        }

        Ok(app_dir)
    }

    /// Internal helper to load & parse a workspace.json file asynchronously.
    async fn get_info_from_dir(dir: &Path) -> Result<WorkspaceInfo, Error> {
        let json_path = dir.join("workspace.json");
        let contents = tokio::fs::read_to_string(&json_path).await?;
        let info: WorkspaceInfo = serde_json::from_str(&contents)
            .map_err(|e| Error::new(ErrorKind::InvalidData, format!("parse error: {e}")))?;
        Ok(info)
    }

    /// Load a workspace directory: read workspace.json and initialize its index database.
    /// Returns (WorkspaceInfo, DatabaseConnection) or an error string explaining why it failed.
    pub async fn load_workspace_from_dir(dir: PathBuf) -> Result<LoadedWorkspace, String> {
        let info = Self::get_info_from_dir(&dir)
            .await
            .map_err(|e| format!("failed to load {}: {}", dir.display(), e))?;

        let fib = dir.join(".fibbelous");
        let db = init_index_db(&fib)
            .await
            .map_err(|e| format!("failed to init index db: {}", e))?;

        let page_manager = Arc::new(PageManager::new(dir.clone(), info.slug.clone()));
        let _ = page_manager.index_pages().await;
        let (events_tx, _rx) = broadcast::channel(100);
        let loaded = LoadedWorkspace {
            id: info.id.clone(),
            path: dir.clone(),
            connection: WorkspaceConnection {
                id: info.id.clone(),
                path: Some(dir.clone()),
                url: None,
                git: None,
            },
            info,
            db,

            page_manager,
            events_tx,
        };

        Ok(loaded)
    }

    /// Reload a workspace's info from disk (workspace.json). If the file is missing, the workspace
    /// is removed from memory. Returns the fresh WorkspaceInfo on success.
    pub async fn reload_workspace_info(&self, id: &str) -> Result<WorkspaceInfo, String> {
        use ErrorKind;
        // First grab path (and existing loaded workspace)
        let loaded = self
            .list
            .get(id)
            .ok_or_else(|| format!("workspace {id} not found"))?;
        let path = loaded.path.clone();

        let info = match Self::get_info_from_dir(&path).await {
            Ok(i) => i,
            Err(e) => {
                if e.kind() == ErrorKind::NotFound {
                    // No write lock, so just return error
                    return Err(format!("workspace {id} removed (file missing)"));
                } else {
                    return Err(format!("failed to load workspace {id}: {e}"));
                }
            }
        };

        // Update in-memory copy so future accesses see fresh info
        if let Some(existing) = self.list.get(id) {
            // Rebuild LoadedWorkspace with updated info, keeping other handles identical
            let new_loaded = LoadedWorkspace {
                id: existing.id.clone(),
                path: existing.path.clone(),
                connection: existing.connection.clone(),
                info: info.clone(),
                db: existing.db.clone(),
                page_manager: existing.page_manager.clone(),
                events_tx: existing.events_tx.clone(),
            };
            // No write lock, so cannot update self.workspaces
            // If you want to update, you need to make workspaces mutable or use interior mutability
        }

        Ok(info)
    }

    pub async fn load_connection(&mut self, conn: WorkspaceConnection) -> Result<(), String> {
        println!("Loading connection: {:?}", conn);

        if let Some(_) = conn.url {
            return Err("Remote workspaces are not supported from a server".into());
        }
        if let Some(p) = conn.path {
            let workspace = Self::load_workspace_from_dir(p).await?;
            self.list.insert(conn.id.clone(), Arc::new(workspace));
        }

        Ok(())
    }
}

// normalize_icon & emoji validation moved to icon.rs

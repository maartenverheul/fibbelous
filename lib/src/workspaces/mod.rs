use crate::{id::generate_hex_id, indexing::init_index_db};
use git2::Repository;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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
    pub created_at: String,
    pub version: u16,
}

impl WorkspaceInfo {
    pub fn default_workspace() -> Self {
        let now = chrono::Utc::now();
        let created_at = now.format("%Y-%m-%dT%H:%M:%S%:z").to_string();
        Self {
            id: generate_hex_id(),
            slug: "default".to_string(),
            title: "Default workspace".to_string(),
            icon: Some("📁".to_string()),
            description: Some("The default workspace".to_string()),
            created_at: created_at,
            version: 1,
        }
    }
}

pub fn workspace_dirs() -> Result<Vec<std::path::PathBuf>, std::io::Error> {
    let workspaces_path = Path::new(WORKSPACES_PATH);
    let mut dirs = Vec::new();
    for entry in std::fs::read_dir(&workspaces_path)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() && path.join(".git").is_dir() {
            dirs.push(path);
        }
    }
    Ok(dirs)
}

pub fn list() -> Result<Vec<WorkspaceInfo>, std::io::Error> {
    let dirs = match workspace_dirs() {
        Ok(dirs) => dirs,
        Err(e) => return Err(e),
    };
    let mut infos = Vec::new();
    for path in dirs {
        let json_path = path.join("workspace.json");
        match std::fs::read_to_string(&json_path) {
            Ok(json) => match serde_json::from_str::<WorkspaceInfo>(&json) {
                Ok(info) => infos.push(info),
                Err(e) => eprintln!("Failed to parse {}: {}", json_path.display(), e),
            },
            Err(e) => eprintln!("Failed to read {}: {}", json_path.display(), e),
        }
    }
    Ok(infos)
}

const WORKSPACES_PATH: &str = ".data/workspaces";

pub fn ensure_workspace() {
    // Ensure the workspaces directory exists
    let workspaces_path = Path::new(WORKSPACES_PATH);
    std::fs::create_dir_all(&workspaces_path).unwrap();

    // Check if at least one workspace already exists
    if list().unwrap().is_empty() {
        // Create the default workspace
        create_default(None).expect("Failed to create default workspace");
    }
}

pub fn create_default(target_path: Option<&Path>) -> Result<git2::Repository, git2::Error> {
    create(&WorkspaceInfo::default_workspace(), target_path)
}

pub fn create(
    settings: &WorkspaceInfo,
    target_path: Option<&Path>,
) -> Result<git2::Repository, git2::Error> {
    println!("Creating workspace {:?}", settings.slug);
    let repo_path: PathBuf = match target_path {
        Some(p) => p.to_path_buf(),
        None => {
            let workspaces_path = Path::new(WORKSPACES_PATH);
            workspaces_path.join(&settings.id)
        }
    };

    // Init repo
    let repo = match Repository::init(&repo_path) {
        Ok(repo) => repo,
        Err(e) => panic!("failed to init: {}", e),
    };

    // Fill repo
    write_workspace_info(&repo_path, &settings).expect("Failed to write workspace info");
    create_workspace_directories(&repo_path).expect("Failed to create workspace directories");
    let fib_folder =
        ensure_fibbelous_folder(&repo_path).expect("Failed to create .fibbelous folder");

    // Start indexing
    init_index_db(&fib_folder).expect("Failed to init index database");

    Ok(repo)
}

fn create_workspace_directories(base_path: &Path) -> Result<(), std::io::Error> {
    let dirs = ["pages", "databases", "content"];
    for dir in dirs.iter() {
        let dir_path = base_path.join(dir);
        if !dir_path.exists() {
            std::fs::create_dir_all(&dir_path)?;
        }
    }
    Ok(())
}

fn write_workspace_info(path: &Path, info: &WorkspaceInfo) -> Result<(), std::io::Error> {
    let json = serde_json::to_string_pretty(info)?;
    std::fs::write(path.join("workspace.json"), json)?;
    Ok(())
}

fn ensure_fibbelous_folder(path: &Path) -> Result<PathBuf, std::io::Error> {
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

use std::path::Path;

use git2::Repository;

pub mod workspace_info;
pub use workspace_info::WorkspaceInfo;

const WORKSPACES_PATH: &str = ".data/workspaces";

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

pub fn ensure_workspace() {
    // Ensure the workspaces directory exists
    let workspaces_path = Path::new(WORKSPACES_PATH);
    std::fs::create_dir_all(&workspaces_path).unwrap();

    // Check if at least one workspace already exists
    if list().unwrap().is_empty() {
        // Create the default workspace
        create_default().expect("Failed to create default workspace");
    }
}

pub fn create_default() -> Result<git2::Repository, git2::Error> {
    create(&WorkspaceInfo::default_workspace())
}

pub fn create(settings: &WorkspaceInfo) -> Result<git2::Repository, git2::Error> {
    println!("Creating workspace {:?}", settings.slug);
    let workspaces_path = Path::new(WORKSPACES_PATH);
    let repo_path = workspaces_path.join(&settings.id);

    let repo = match Repository::init(&repo_path) {
        Ok(repo) => repo,
        Err(e) => panic!("failed to init: {}", e),
    };

    // Create directories inside the new repo after repo init
    let dirs = ["pages", "databases", "content"];
    for dir in dirs.iter() {
        let dir_path = repo_path.join(dir);
        if let Err(e) = std::fs::create_dir_all(&dir_path) {
            eprintln!("Failed to create directory {}: {}", dir_path.display(), e);
        } else {
            println!("Created directory: {}", dir_path.display());
        }
    }

    let json = serde_json::to_string_pretty(&settings).expect("Failed to serialize settings");
    let json_path = repo_path.join("workspace.json");
    if let Err(e) = std::fs::write(&json_path, json) {
        eprintln!("Failed to write workspace.json: {}", e);
    } else {
        println!("Created settings: {}", json_path.display());
    }

    Ok(repo)
}

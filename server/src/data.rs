use std::path::{Path, PathBuf};

const DATA_DIR: &str = ".data";
const WORKSPACES_DIR: &str = ".data/workspaces";

pub fn data_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(DATA_DIR)
}

pub fn workspaces_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(WORKSPACES_DIR)
}

pub fn ensure_workspaces_dir() -> std::io::Result<PathBuf> {
    let path = workspaces_dir();
    std::fs::create_dir_all(&path)
        .inspect_err(|error| log_fs_error(&path, "create_dir_all", error))?;
    Ok(path)
}

pub fn log_path(path: &Path) -> String {
    match path.strip_prefix(data_dir()) {
        Ok(relative) if relative.as_os_str().is_empty() => DATA_DIR.into(),
        Ok(relative) => format!(
            "{DATA_DIR}/{}",
            relative.to_string_lossy().replace('\\', "/")
        ),
        Err(_) => path.to_string_lossy().replace('\\', "/"),
    }
}

/// Log a filesystem I/O failure (permissions, missing path, etc.) to the console.
pub fn log_fs_error(path: &Path, op: &str, error: &std::io::Error) {
    tracing::error!(
        path = %log_path(path),
        op,
        %error,
        kind = ?error.kind(),
        "filesystem error"
    );
}

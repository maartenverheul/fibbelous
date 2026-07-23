use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::sync::Notify;

use crate::cache::CacheDb;

#[derive(Debug, Clone)]
pub enum DirtyKey {
    Page(String),
    Database(String),
    Row(String),
}

#[derive(Clone)]
pub struct FlushScheduler {
    notify: Arc<Notify>,
    pending_deletes: Arc<Mutex<HashSet<String>>>,
}

impl FlushScheduler {
    pub fn new() -> Self {
        Self {
            notify: Arc::new(Notify::new()),
            pending_deletes: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn mark(&self, _key: DirtyKey) {
        self.notify.notify_one();
    }

    pub fn mark_delete(&self, relative_path: String) {
        if let Ok(mut pending) = self.pending_deletes.lock() {
            pending.insert(relative_path);
        }
        self.notify.notify_one();
    }
}

pub fn spawn_flush(workspace_path: PathBuf, cache: Arc<Mutex<CacheDb>>, scheduler: FlushScheduler) {
    tokio::spawn(async move {
        loop {
            scheduler.notify.notified().await;
            tokio::time::sleep(Duration::from_millis(300)).await;
            let path = workspace_path.clone();
            let cache = cache.clone();
            let deletes = {
                let Ok(mut pending) = scheduler.pending_deletes.lock() else {
                    continue;
                };
                std::mem::take(&mut *pending)
            };
            let _ = tokio::task::spawn_blocking(move || {
                flush_pending(&path, &cache, &deletes)
            })
            .await;
        }
    });
}

pub fn flush_pending(
    workspace_path: &PathBuf,
    cache: &Arc<Mutex<CacheDb>>,
    pending_deletes: &HashSet<String>,
) -> Result<(), String> {
    for relative in pending_deletes {
        let path = workspace_path.join(relative);
        if path.is_file() {
            let _ = fs::remove_file(&path);
        }
    }

    let mut cache = cache.lock().map_err(|_| "cache mutex poisoned".to_owned())?;
    for (id, path, content) in cache.dirty_pages().map_err(|e| e.to_string())? {
        write(workspace_path, &path, &content)?;
        cache.clear_page_dirty(&id).map_err(|e| e.to_string())?;
    }
    for (id, path, content) in cache.dirty_databases().map_err(|e| e.to_string())? {
        write(workspace_path, &path, &content)?;
        cache.clear_database_dirty(&id).map_err(|e| e.to_string())?;
    }
    for (id, path, content) in cache.dirty_database_rows().map_err(|e| e.to_string())? {
        write(workspace_path, &path, &content)?;
        cache.clear_database_row_dirty(&id).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn write(workspace_path: &PathBuf, relative_path: &str, content: &str) -> Result<(), String> {
    let path = workspace_path.join(relative_path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

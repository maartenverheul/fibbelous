use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::cache::{CacheDb, IndexedDatabase, IndexedPage};
use crate::data::log_path;

const BATCH_SIZE: usize = 128;

#[derive(Debug, Default, Clone, Copy)]
pub struct SyncStats {
    pub scanned: usize,
    pub updated: usize,
    pub skipped: usize,
    pub removed: usize,
}

pub fn sync_workspace(workspace_path: &Path, cache: &mut CacheDb) -> io::Result<SyncStats> {
    let mut stats = SyncStats::default();
    sync_pages(workspace_path, cache, &mut stats)?;
    sync_databases(workspace_path, cache, &mut stats)?;
    Ok(stats)
}

fn sync_pages(workspace_path: &Path, cache: &mut CacheDb, stats: &mut SyncStats) -> io::Result<()> {
    let pages_dir = workspace_path.join("pages");
    let mut seen_paths = HashSet::new();
    let mut batch = Vec::with_capacity(BATCH_SIZE);

    if pages_dir.is_dir() {
        for file in walk_files(&pages_dir)? {
            if file.extension().and_then(|ext| ext.to_str()) != Some("mdx") {
                continue;
            }

            let relative_path = path_relative_to_workspace(workspace_path, &file);
            seen_paths.insert(relative_path.clone());
            stats.scanned += 1;

            let metadata = fs::metadata(&file)?;
            let modified_ns = file_modified_ns(&metadata)?;
            let size_bytes = metadata.len();

            if !cache
                .page_is_stale(&relative_path, modified_ns, size_bytes)
                .map_err(|error| io::Error::other(error.to_string()))?
            {
                stats.skipped += 1;
                continue;
            }

            let content = fs::read_to_string(&file)?;
            let frontmatter = parse_frontmatter(&content);
            let id = frontmatter
                .get("id")
                .cloned()
                .unwrap_or_else(|| file_stem_id(&file));

            batch.push(IndexedPage {
                path: relative_path,
                id,
                slug: frontmatter.get("slug").cloned(),
                title: frontmatter.get("title").cloned(),
                icon: frontmatter.get("icon").cloned(),
                content,
                modified_ns,
                size_bytes,
            });

            if batch.len() >= BATCH_SIZE {
                flush_pages(cache, &mut batch, stats)?;
            }
        }
    }

    flush_pages(cache, &mut batch, stats)?;
    stats.removed += cache
        .delete_pages_not_in(&seen_paths)
        .map_err(|error| io::Error::other(error.to_string()))?;

    Ok(())
}

fn sync_databases(
    workspace_path: &Path,
    cache: &mut CacheDb,
    stats: &mut SyncStats,
) -> io::Result<()> {
    let databases_dir = workspace_path.join("databases");
    let mut seen_paths = HashSet::new();
    let mut batch = Vec::with_capacity(BATCH_SIZE);

    if databases_dir.is_dir() {
        for entry in fs::read_dir(&databases_dir)? {
            let entry = entry?;
            let database_dir = entry.path();
            if !database_dir.is_dir() {
                continue;
            }

            let database_json = database_dir.join("database.json");
            if !database_json.is_file() {
                continue;
            }

            let relative_path = path_relative_to_workspace(workspace_path, &database_json);
            seen_paths.insert(relative_path.clone());
            stats.scanned += 1;

            let metadata = fs::metadata(&database_json)?;
            let modified_ns = file_modified_ns(&metadata)?;
            let size_bytes = metadata.len();

            if !cache
                .database_is_stale(&relative_path, modified_ns, size_bytes)
                .map_err(|error| io::Error::other(error.to_string()))?
            {
                stats.skipped += 1;
                continue;
            }

            let contents = fs::read_to_string(&database_json)?;
            let value: serde_json::Value = match serde_json::from_str(&contents) {
                Ok(value) => value,
                Err(error) => {
                    tracing::warn!(path = %log_path(&database_json), %error, "skipping invalid database.json");
                    stats.scanned -= 1;
                    seen_paths.remove(&relative_path);
                    continue;
                }
            };

            let id = value
                .get("id")
                .and_then(|value| value.as_str())
                .map(str::to_owned)
                .unwrap_or_else(|| entry.file_name().to_string_lossy().into_owned());

            batch.push(IndexedDatabase {
                path: relative_path,
                id,
                slug: value
                    .get("slug")
                    .and_then(|value| value.as_str())
                    .map(str::to_owned),
                name: value
                    .get("name")
                    .and_then(|value| value.as_str())
                    .map(str::to_owned),
                modified_ns,
                size_bytes,
            });

            if batch.len() >= BATCH_SIZE {
                flush_databases(cache, &mut batch, stats)?;
            }
        }
    }

    flush_databases(cache, &mut batch, stats)?;
    stats.removed += cache
        .delete_databases_not_in(&seen_paths)
        .map_err(|error| io::Error::other(error.to_string()))?;

    Ok(())
}

fn flush_pages(cache: &mut CacheDb, batch: &mut Vec<IndexedPage>, stats: &mut SyncStats) -> io::Result<()> {
    if batch.is_empty() {
        return Ok(());
    }

    cache
        .upsert_pages(batch)
        .map_err(|error| io::Error::other(error.to_string()))?;
    stats.updated += batch.len();
    batch.clear();
    Ok(())
}

fn flush_databases(
    cache: &mut CacheDb,
    batch: &mut Vec<IndexedDatabase>,
    stats: &mut SyncStats,
) -> io::Result<()> {
    if batch.is_empty() {
        return Ok(());
    }

    cache
        .upsert_databases(batch)
        .map_err(|error| io::Error::other(error.to_string()))?;
    stats.updated += batch.len();
    batch.clear();
    Ok(())
}

fn file_modified_ns(metadata: &fs::Metadata) -> io::Result<i64> {
    let modified = metadata.modified()?;
    let duration = modified
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|error| io::Error::other(error.to_string()))?;

    i64::try_from(duration.as_nanos()).map_err(|error| io::Error::other(error.to_string()))
}

fn walk_files(dir: &Path) -> io::Result<Vec<PathBuf>> {
    let mut files = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            files.extend(walk_files(&path)?);
        } else if path.is_file() {
            files.push(path);
        }
    }

    Ok(files)
}

fn path_relative_to_workspace(workspace_path: &Path, file_path: &Path) -> String {
    file_path
        .strip_prefix(workspace_path)
        .unwrap_or(file_path)
        .to_string_lossy()
        .replace('\\', "/")
}

fn file_stem_id(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or_default()
        .to_owned()
}

fn parse_frontmatter(content: &str) -> HashMap<String, String> {
    let mut fields = HashMap::new();
    let content = content.trim_start();

    if !content.starts_with("---") {
        return fields;
    }

    let Some(rest) = content.strip_prefix("---") else {
        return fields;
    };

    let Some(end) = rest.find("\n---") else {
        return fields;
    };

    for line in rest[..end].lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let Some((key, value)) = line.split_once(':') else {
            continue;
        };

        fields.insert(key.trim().to_owned(), value.trim().to_owned());
    }

    fields
}

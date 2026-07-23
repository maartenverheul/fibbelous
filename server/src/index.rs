use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::cache::{CacheDb, IndexedDatabase, IndexedDatabaseRow, IndexedPage, parent_id_from_page_path};
use crate::databases::DatabaseFile;
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
                parent_id: parent_id_from_page_path(&relative_path),
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
    let mut seen_database_paths = HashSet::new();
    let mut seen_row_paths = HashSet::new();
    let mut database_batch = Vec::with_capacity(BATCH_SIZE);
    let mut row_batch = Vec::with_capacity(BATCH_SIZE);

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
            seen_database_paths.insert(relative_path.clone());
            stats.scanned += 1;

            let metadata = fs::metadata(&database_json)?;
            let modified_ns = file_modified_ns(&metadata)?;
            let size_bytes = metadata.len();

            let contents = fs::read_to_string(&database_json)?;
            let database: DatabaseFile = match serde_json::from_str(&contents) {
                Ok(database) => database,
                Err(error) => {
                    tracing::warn!(path = %log_path(&database_json), %error, "skipping invalid database.json");
                    stats.scanned -= 1;
                    seen_database_paths.remove(&relative_path);
                    continue;
                }
            };

            let database_id = if database.id.is_empty() {
                entry.file_name().to_string_lossy().into_owned()
            } else {
                database.id.clone()
            };

            if cache
                .database_is_stale(&relative_path, modified_ns, size_bytes)
                .map_err(|error| io::Error::other(error.to_string()))?
            {
                database_batch.push(IndexedDatabase {
                    path: relative_path,
                    id: database_id.clone(),
                    slug: database.slug,
                    name: database.name.or(database.title),
                    content: contents,
                    modified_ns,
                    size_bytes,
                });

                if database_batch.len() >= BATCH_SIZE {
                    flush_databases(cache, &mut database_batch, stats)?;
                }
            } else {
                stats.skipped += 1;
            }

            sync_database_rows(
                workspace_path,
                cache,
                &database_dir,
                &database_id,
                &mut seen_row_paths,
                &mut row_batch,
                stats,
            )?;
        }
    }

    flush_databases(cache, &mut database_batch, stats)?;
    flush_database_rows(cache, &mut row_batch, stats)?;
    stats.removed += cache
        .delete_databases_not_in(&seen_database_paths)
        .map_err(|error| io::Error::other(error.to_string()))?;
    stats.removed += cache
        .delete_database_rows_not_in(&seen_row_paths)
        .map_err(|error| io::Error::other(error.to_string()))?;

    Ok(())
}

fn sync_database_rows(
    workspace_path: &Path,
    cache: &mut CacheDb,
    database_dir: &Path,
    database_id: &str,
    seen_row_paths: &mut HashSet<String>,
    batch: &mut Vec<IndexedDatabaseRow>,
    stats: &mut SyncStats,
) -> io::Result<()> {
    for entry in fs::read_dir(database_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("mdx") {
            continue;
        }

        let relative_path = path_relative_to_workspace(workspace_path, &path);
        seen_row_paths.insert(relative_path.clone());
        stats.scanned += 1;

        let metadata = fs::metadata(&path)?;
        let modified_ns = file_modified_ns(&metadata)?;
        let size_bytes = metadata.len();

        if !cache
            .database_row_is_stale(&relative_path, modified_ns, size_bytes)
            .map_err(|error| io::Error::other(error.to_string()))?
        {
            stats.skipped += 1;
            continue;
        }

        let content = fs::read_to_string(&path)?;
        let row = match parse_database_row(&content, &path, database_id) {
            Ok(row) => row,
            Err(error) => {
                tracing::warn!(path = %log_path(&path), %error, "skipping invalid database row");
                stats.scanned -= 1;
                seen_row_paths.remove(&relative_path);
                continue;
            }
        };

        batch.push(IndexedDatabaseRow {
            path: relative_path,
            database_id: database_id.to_owned(),
            id: row.id,
            slug: row.slug,
            title: row.title,
            icon: row.icon,
            created: row.created,
            edited: row.edited,
            attributes_json: row.attributes_json,
            content,
            modified_ns,
            size_bytes,
        });

        if batch.len() >= BATCH_SIZE {
            flush_database_rows(cache, batch, stats)?;
        }
    }

    Ok(())
}

struct ParsedDatabaseRow {
    id: String,
    slug: Option<String>,
    title: Option<String>,
    icon: Option<String>,
    created: Option<String>,
    edited: Option<String>,
    attributes_json: String,
}

fn parse_database_row(
    content: &str,
    path: &Path,
    _database_id: &str,
) -> Result<ParsedDatabaseRow, String> {
    let yaml = extract_frontmatter_yaml(content).unwrap_or("");
    let value: serde_yaml::Value = if yaml.trim().is_empty() {
        serde_yaml::Value::Mapping(serde_yaml::Mapping::new())
    } else {
        serde_yaml::from_str(yaml).map_err(|error| error.to_string())?
    };

    let mapping = value.as_mapping();
    let id = mapping
        .and_then(|map| map.get(serde_yaml::Value::String("id".into())))
        .and_then(yaml_value_to_string)
        .unwrap_or_else(|| file_stem_id(path));

    let attributes = mapping
        .and_then(|map| map.get(serde_yaml::Value::String("attributes".into())))
        .cloned()
        .unwrap_or(serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));
    let attributes_json = serde_json::to_string(&yaml_to_json(attributes))
        .map_err(|error| error.to_string())?;

    Ok(ParsedDatabaseRow {
        id,
        slug: mapping
            .and_then(|map| map.get(serde_yaml::Value::String("slug".into())))
            .and_then(yaml_value_to_string),
        title: mapping
            .and_then(|map| map.get(serde_yaml::Value::String("title".into())))
            .and_then(yaml_value_to_string),
        icon: mapping
            .and_then(|map| map.get(serde_yaml::Value::String("icon".into())))
            .and_then(yaml_value_to_string),
        created: mapping
            .and_then(|map| map.get(serde_yaml::Value::String("created".into())))
            .and_then(yaml_value_to_string),
        edited: mapping
            .and_then(|map| map.get(serde_yaml::Value::String("edited".into())))
            .and_then(yaml_value_to_string),
        attributes_json,
    })
}

fn extract_frontmatter_yaml(content: &str) -> Option<&str> {
    let content = content.trim_start();
    let rest = content.strip_prefix("---")?;
    let end = rest.find("\n---")?;
    Some(&rest[..end])
}

fn yaml_value_to_string(value: &serde_yaml::Value) -> Option<String> {
    match value {
        serde_yaml::Value::String(text) => Some(text.clone()),
        serde_yaml::Value::Bool(flag) => Some(flag.to_string()),
        serde_yaml::Value::Number(number) => Some(number.to_string()),
        serde_yaml::Value::Null => None,
        other => Some(
            serde_yaml::to_string(other)
                .unwrap_or_default()
                .trim()
                .to_owned(),
        ),
    }
    .filter(|text| !text.is_empty())
}

fn yaml_to_json(value: serde_yaml::Value) -> serde_json::Value {
    serde_json::to_value(value).unwrap_or(serde_json::Value::Null)
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

fn flush_database_rows(
    cache: &mut CacheDb,
    batch: &mut Vec<IndexedDatabaseRow>,
    stats: &mut SyncStats,
) -> io::Result<()> {
    if batch.is_empty() {
        return Ok(());
    }

    cache
        .upsert_database_rows(batch)
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

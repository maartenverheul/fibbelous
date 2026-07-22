use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

use crate::data::log_path;

pub const FIBBELOUS_DIR: &str = ".fibbelous";
const CACHE_DB_FILE: &str = "cache.db";
const FORMAT_VERSION_KEY: &str = "format_version";
pub const CACHE_DB_VERSION: i64 = 3;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
    path TEXT PRIMARY KEY NOT NULL,
    id TEXT NOT NULL,
    slug TEXT,
    title TEXT,
    icon TEXT,
    content TEXT NOT NULL,
    modified_ns INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pages_id ON pages(id);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);

CREATE TABLE IF NOT EXISTS databases (
    path TEXT PRIMARY KEY NOT NULL,
    id TEXT NOT NULL,
    slug TEXT,
    name TEXT,
    modified_ns INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_databases_id ON databases(id);
CREATE INDEX IF NOT EXISTS idx_databases_slug ON databases(slug);
";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSummary {
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub path: String,
    pub has_children: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageDetail {
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub path: String,
    pub has_children: bool,
    pub body: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchPageHit {
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub path: String,
    pub has_children: bool,
    pub match_in: String,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone)]
pub struct IndexedPage {
    pub path: String,
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub content: String,
    pub modified_ns: i64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone)]
pub struct IndexedDatabase {
    pub path: String,
    pub id: String,
    pub slug: Option<String>,
    pub name: Option<String>,
    pub modified_ns: i64,
    pub size_bytes: u64,
}

pub struct CacheDb {
    conn: Connection,
}

impl CacheDb {
    pub fn open(runtime_dir: &Path) -> rusqlite::Result<Self> {
        let db_path = runtime_dir.join(CACHE_DB_FILE);
        reset_if_outdated(&db_path);

        let mut conn = Connection::open(&db_path)?;
        conn.execute_batch(SCHEMA)?;

        if !schema_is_current(&conn) {
            drop(conn);
            remove_cache_file(&db_path);
            conn = Connection::open(&db_path)?;
            conn.execute_batch(SCHEMA)?;
        }

        set_format_version(&conn)?;

        Ok(Self { conn })
    }

    pub fn page_is_stale(
        &self,
        path: &str,
        modified_ns: i64,
        size_bytes: u64,
    ) -> rusqlite::Result<bool> {
        match self.conn.query_row(
            "SELECT modified_ns, size_bytes FROM pages WHERE path = ?1",
            params![path],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, u64>(1)?)),
        ) {
            Ok((cached_modified, cached_size)) => {
                Ok(cached_modified != modified_ns || cached_size != size_bytes)
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(true),
            Err(error) => Err(error),
        }
    }

    pub fn database_is_stale(
        &self,
        path: &str,
        modified_ns: i64,
        size_bytes: u64,
    ) -> rusqlite::Result<bool> {
        match self.conn.query_row(
            "SELECT modified_ns, size_bytes FROM databases WHERE path = ?1",
            params![path],
            |row| Ok((row.get::<_, i64>(0)?, row.get::<_, u64>(1)?)),
        ) {
            Ok((cached_modified, cached_size)) => {
                Ok(cached_modified != modified_ns || cached_size != size_bytes)
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(true),
            Err(error) => Err(error),
        }
    }

    pub fn upsert_pages(&mut self, pages: &[IndexedPage]) -> rusqlite::Result<()> {
        for page in pages {
            self.conn.execute(
                "INSERT INTO pages (path, id, slug, title, icon, content, modified_ns, size_bytes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 ON CONFLICT(path) DO UPDATE SET
                    id = excluded.id,
                    slug = excluded.slug,
                    title = excluded.title,
                    icon = excluded.icon,
                    content = excluded.content,
                    modified_ns = excluded.modified_ns,
                    size_bytes = excluded.size_bytes",
                params![
                    page.path,
                    page.id,
                    page.slug,
                    page.title,
                    page.icon,
                    page.content,
                    page.modified_ns,
                    page.size_bytes,
                ],
            )?;
        }

        Ok(())
    }

    pub fn upsert_databases(&mut self, databases: &[IndexedDatabase]) -> rusqlite::Result<()> {
        for database in databases {
            self.conn.execute(
                "INSERT INTO databases (path, id, slug, name, modified_ns, size_bytes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(path) DO UPDATE SET
                    id = excluded.id,
                    slug = excluded.slug,
                    name = excluded.name,
                    modified_ns = excluded.modified_ns,
                    size_bytes = excluded.size_bytes",
                params![
                    database.path,
                    database.id,
                    database.slug,
                    database.name,
                    database.modified_ns,
                    database.size_bytes,
                ],
            )?;
        }

        Ok(())
    }

    pub fn list_pages_in_dir(&self, parent_dir: &str) -> rusqlite::Result<Vec<PageSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, slug, title, icon, path FROM pages
             WHERE path LIKE ?1 || '/%' AND path NOT LIKE ?1 || '/%/%'
             ORDER BY COALESCE(title, id) COLLATE NOCASE",
        )?;
        let rows = stmt
            .query_map(params![parent_dir], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut pages = Vec::with_capacity(rows.len());
        for (id, slug, title, icon, path) in rows {
            let has_children = self.dir_has_pages(&children_dir(&path, &id))?;
            pages.push(PageSummary {
                id,
                slug,
                title,
                icon,
                path,
                has_children,
            });
        }

        Ok(pages)
    }

    pub fn get_page_by_id(&self, id: &str) -> rusqlite::Result<Option<PageDetail>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, slug, title, icon, path, content FROM pages WHERE id = ?1 LIMIT 1",
        )?;
        let row = stmt
            .query_row(params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            })
            .optional()?;

        let Some((id, slug, title, icon, path, content)) = row else {
            return Ok(None);
        };

        let has_children = self.dir_has_pages(&children_dir(&path, &id))?;
        Ok(Some(PageDetail {
            id,
            slug,
            title,
            icon,
            path,
            has_children,
            body: strip_frontmatter(&content).to_owned(),
        }))
    }

    pub fn search_pages(&self, query: &str, limit: usize) -> rusqlite::Result<Vec<SearchPageHit>> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(Vec::new());
        }

        let limit = limit.clamp(1, 100);
        let pattern = format!("%{}%", escape_like(query));

        let mut stmt = self.conn.prepare(
            "SELECT id, slug, title, icon, path, content FROM pages
             WHERE title LIKE ?1 ESCAPE '\\' COLLATE NOCASE
                OR slug LIKE ?1 ESCAPE '\\' COLLATE NOCASE
                OR content LIKE ?1 ESCAPE '\\' COLLATE NOCASE
             ORDER BY
               CASE
                 WHEN title LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 0
                 WHEN slug LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 1
                 ELSE 2
               END,
               COALESCE(title, id) COLLATE NOCASE
             LIMIT ?2",
        )?;

        let rows = stmt
            .query_map(params![pattern, limit as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut hits = Vec::with_capacity(rows.len());
        for (id, slug, title, icon, path, content) in rows {
            let (match_in, snippet) = classify_match(query, title.as_deref(), slug.as_deref(), &content);
            let has_children = self.dir_has_pages(&children_dir(&path, &id))?;
            hits.push(SearchPageHit {
                id,
                slug,
                title,
                icon,
                path,
                has_children,
                match_in,
                snippet,
            });
        }

        Ok(hits)
    }

    fn dir_has_pages(&self, dir: &str) -> rusqlite::Result<bool> {
        self.conn.query_row(
            "SELECT EXISTS(
                SELECT 1 FROM pages
                WHERE path LIKE ?1 || '/%' AND path NOT LIKE ?1 || '/%/%'
             )",
            params![dir],
            |row| row.get(0),
        )
    }

    pub fn delete_pages_not_in(&mut self, paths: &HashSet<String>) -> rusqlite::Result<usize> {
        delete_rows_not_in(&self.conn, "pages", paths)
    }

    pub fn delete_databases_not_in(&mut self, paths: &HashSet<String>) -> rusqlite::Result<usize> {
        delete_rows_not_in(&self.conn, "databases", paths)
    }
}

fn delete_rows_not_in(
    conn: &Connection,
    table: &str,
    paths: &HashSet<String>,
) -> rusqlite::Result<usize> {
    if paths.is_empty() {
        return conn.execute(&format!("DELETE FROM {table}"), []).map(|count| count as usize);
    }

    let mut removed = 0usize;
    let mut stmt = conn.prepare(&format!("SELECT path FROM {table}"))?;
    let existing = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    for path in existing {
        if paths.contains(&path) {
            continue;
        }

        removed += conn.execute(
            &format!("DELETE FROM {table} WHERE path = ?1"),
            params![path],
        )? as usize;
    }

    Ok(removed)
}

fn schema_is_current(conn: &Connection) -> bool {
    conn.prepare("SELECT modified_ns, size_bytes FROM pages LIMIT 0")
        .is_ok()
        && conn
            .prepare("SELECT modified_ns, size_bytes FROM databases LIMIT 0")
            .is_ok()
}

fn reset_if_outdated(db_path: &Path) {
    if !db_path.is_file() {
        return;
    }

    let outdated = {
        let Ok(conn) = Connection::open(db_path) else {
            return remove_cache_file(db_path);
        };

        let version = conn
            .query_row(
                "SELECT value FROM metadata WHERE key = ?1",
                params![FORMAT_VERSION_KEY],
                |row| row.get::<_, String>(0),
            )
            .ok()
            .and_then(|value| value.parse::<i64>().ok());

        version.is_none_or(|version| version < CACHE_DB_VERSION)
            || !schema_is_current(&conn)
    };

    if outdated {
        remove_cache_file(db_path);
    }
}

fn remove_cache_file(db_path: &Path) {
    if let Err(error) = fs::remove_file(db_path) {
        tracing::warn!(path = %log_path(db_path), %error, "failed to remove cache database");
        return;
    }

    tracing::info!(
        path = %log_path(db_path),
        expected = CACHE_DB_VERSION,
        "removed outdated cache database"
    );
}

fn set_format_version(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES (?1, ?2)",
        params![FORMAT_VERSION_KEY, CACHE_DB_VERSION.to_string()],
    )?;
    Ok(())
}

pub fn children_dir(page_path: &str, page_id: &str) -> String {
    let parent = Path::new(page_path)
        .parent()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|| "pages".to_owned());
    format!("{parent}/{page_id}")
}

fn strip_frontmatter(content: &str) -> &str {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return content;
    }

    let Some(rest) = content.strip_prefix("---") else {
        return content;
    };

    let Some(end) = rest.find("\n---") else {
        return content;
    };

    rest[end + 4..].trim_start()
}

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn contains_nocase(haystack: &str, needle: &str) -> bool {
    haystack.to_lowercase().contains(&needle.to_lowercase())
}

fn classify_match(
    query: &str,
    title: Option<&str>,
    slug: Option<&str>,
    content: &str,
) -> (String, Option<String>) {
    if title.is_some_and(|title| contains_nocase(title, query)) {
        return ("title".to_owned(), None);
    }
    if slug.is_some_and(|slug| contains_nocase(slug, query)) {
        return ("slug".to_owned(), None);
    }

    let body = strip_frontmatter(content);
    ("body".to_owned(), make_snippet(body, query))
}

fn make_snippet(body: &str, query: &str) -> Option<String> {
    const RADIUS: usize = 50;

    let lower_body = body.to_lowercase();
    let lower_query = query.to_lowercase();
    let match_start = lower_body.find(&lower_query)?;
    let match_end = match_start + query.len();

    let prefix_chars = body[..match_start].chars().count();
    let start_char = prefix_chars.saturating_sub(RADIUS);
    let end_char = prefix_chars + query.chars().count() + RADIUS;

    let byte_start = body
        .char_indices()
        .nth(start_char)
        .map(|(offset, _)| offset)
        .unwrap_or(0);
    let byte_end = body
        .char_indices()
        .nth(end_char)
        .map(|(offset, _)| offset)
        .unwrap_or_else(|| body.len());

    // Keep match_end visible even if char math underestimates UTF-8 length.
    let byte_end = byte_end.max(match_end.min(body.len()));

    let mut snippet = body[byte_start..byte_end].trim().to_owned();
    if byte_start > 0 {
        snippet.insert_str(0, "…");
    }
    if byte_end < body.len() {
        snippet.push('…');
    }
    Some(snippet)
}

pub fn runtime_dir(workspace_path: &Path) -> PathBuf {
    workspace_path.join(FIBBELOUS_DIR)
}

pub fn ensure_runtime_dir(workspace_path: &Path) -> std::io::Result<PathBuf> {
    let path = runtime_dir(workspace_path);
    fs::create_dir_all(&path)?;
    ensure_workspace_gitignore(workspace_path)?;
    Ok(path)
}

fn ensure_workspace_gitignore(workspace_path: &Path) -> std::io::Result<()> {
    const ENTRY: &str = ".fibbelous/";
    let gitignore_path = workspace_path.join(".gitignore");

    if gitignore_path.is_file() {
        let contents = fs::read_to_string(&gitignore_path)?;
        let already_ignored = contents.lines().any(|line| {
            let trimmed = line.trim();
            trimmed == ENTRY || trimmed == ".fibbelous" || trimmed == "**/.fibbelous/" || trimmed == "**/.fibbelous"
        });
        if already_ignored {
            return Ok(());
        }

        let mut updated = contents;
        if !updated.is_empty() && !updated.ends_with('\n') {
            updated.push('\n');
        }
        updated.push_str(ENTRY);
        updated.push('\n');
        return fs::write(gitignore_path, updated);
    }

    fs::write(gitignore_path, format!("{ENTRY}\n"))
}

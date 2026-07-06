use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{Connection, params};

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
        "reset cache database for reindexing"
    );
}

fn set_format_version(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO metadata (key, value) VALUES (?1, ?2)",
        params![FORMAT_VERSION_KEY, CACHE_DB_VERSION.to_string()],
    )?;
    Ok(())
}

pub fn runtime_dir(workspace_path: &Path) -> PathBuf {
    workspace_path.join(FIBBELOUS_DIR)
}

pub fn ensure_runtime_dir(workspace_path: &Path) -> std::io::Result<PathBuf> {
    let path = runtime_dir(workspace_path);
    fs::create_dir_all(&path)?;
    Ok(path)
}

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::data::log_path;

pub const FIBBELOUS_DIR: &str = ".fibbelous";
const CACHE_DB_FILE: &str = "cache.db";
const FORMAT_VERSION_KEY: &str = "format_version";
pub const CACHE_DB_VERSION: i64 = 7;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
    path TEXT PRIMARY KEY NOT NULL,
    id TEXT NOT NULL,
    parent_id TEXT,
    slug TEXT,
    title TEXT,
    icon TEXT,
    content TEXT NOT NULL,
    favorite INTEGER NOT NULL DEFAULT 0,
    modified_ns INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    fs_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pages_id ON pages(id);
CREATE INDEX IF NOT EXISTS idx_pages_parent_id ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug);
CREATE INDEX IF NOT EXISTS idx_pages_favorite ON pages(favorite);

CREATE TABLE IF NOT EXISTS databases (
    path TEXT PRIMARY KEY NOT NULL,
    id TEXT NOT NULL,
    slug TEXT,
    name TEXT,
    content TEXT NOT NULL DEFAULT '',
    modified_ns INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    fs_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_databases_id ON databases(id);
CREATE INDEX IF NOT EXISTS idx_databases_slug ON databases(slug);

CREATE TABLE IF NOT EXISTS database_rows (
    path TEXT PRIMARY KEY NOT NULL,
    database_id TEXT NOT NULL,
    id TEXT NOT NULL,
    slug TEXT,
    title TEXT,
    icon TEXT,
    created TEXT,
    edited TEXT,
    attributes_json TEXT NOT NULL,
    content TEXT NOT NULL,
    favorite INTEGER NOT NULL DEFAULT 0,
    modified_ns INTEGER NOT NULL,
    size_bytes INTEGER NOT NULL,
    fs_dirty INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_database_rows_database_id ON database_rows(database_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_database_rows_id ON database_rows(id);
CREATE INDEX IF NOT EXISTS idx_database_rows_favorite ON database_rows(favorite);
";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSummary {
    pub id: String,
    pub parent_id: Option<String>,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub path: String,
    pub has_children: bool,
    pub favorite: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_id: Option<String>,
    /// Nested children when `list_pages` is called with depth > 1.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<PageSummary>>,
}

/// A page linked from another page's body (internal `.mdx` href).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferencedPage {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    /// Workspace-relative path used as the full internal link, e.g. `pages/{id}-{slug}.mdx`.
    pub link: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageDetail {
    pub id: String,
    pub parent_id: Option<String>,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub path: String,
    pub has_children: bool,
    pub favorite: bool,
    /// Set when this page is a database row; id of the parent database / host page.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub database_id: Option<String>,
    /// Database-row attribute map from frontmatter; omitted for normal pages.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attributes: Option<serde_json::Value>,
    /// Row frontmatter `created` (ISO); omitted for normal pages.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created: Option<String>,
    /// Row frontmatter `edited` (ISO); omitted for normal pages.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited: Option<String>,
    pub body: String,
    /// First 10 hex chars of SHA-256(`body` UTF-8 bytes).
    pub body_hash: String,
    /// Pages referenced by internal `.mdx` links in `body`.
    pub referenced_pages: Vec<ReferencedPage>,
    pub ancestors: Vec<PageSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchPageHit {
    pub id: String,
    pub parent_id: Option<String>,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub path: String,
    pub has_children: bool,
    pub favorite: bool,
    pub match_in: String,
    pub snippet: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseDetail {
    pub id: String,
    pub slug: Option<String>,
    pub name: Option<String>,
    pub path: String,
    /// Full contents of `database.json`.
    pub json: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct DatabaseMeta {
    pub id: String,
    pub slug: Option<String>,
    pub name: Option<String>,
    pub path: String,
}

#[derive(Debug, Clone)]
pub struct IndexedPage {
    pub path: String,
    pub id: String,
    pub parent_id: Option<String>,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub content: String,
    pub favorite: bool,
    pub modified_ns: i64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone)]
pub struct IndexedDatabase {
    pub path: String,
    pub id: String,
    pub slug: Option<String>,
    pub name: Option<String>,
    pub content: String,
    pub modified_ns: i64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone)]
pub struct IndexedDatabaseRow {
    pub path: String,
    pub database_id: String,
    pub favorite: bool,
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub created: Option<String>,
    pub edited: Option<String>,
    pub attributes_json: String,
    pub content: String,
    pub modified_ns: i64,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseRowSummary {
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub created: Option<String>,
    pub edited: Option<String>,
    pub attributes: serde_json::Value,
    pub path: String,
    pub database_id: String,
    pub favorite: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseRowsPage {
    pub rows: Vec<DatabaseRowSummary>,
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
    pub has_more: bool,
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
            "SELECT modified_ns, size_bytes, fs_dirty FROM pages WHERE path = ?1",
            params![path],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, u64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        ) {
            Ok((cached_modified, cached_size, fs_dirty)) => {
                Ok(fs_dirty == 0 && (cached_modified != modified_ns || cached_size != size_bytes))
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
            "SELECT modified_ns, size_bytes, fs_dirty FROM databases WHERE path = ?1",
            params![path],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, u64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        ) {
            Ok((cached_modified, cached_size, fs_dirty)) => {
                Ok(fs_dirty == 0 && (cached_modified != modified_ns || cached_size != size_bytes))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(true),
            Err(error) => Err(error),
        }
    }

    pub fn database_row_is_stale(
        &self,
        path: &str,
        modified_ns: i64,
        size_bytes: u64,
    ) -> rusqlite::Result<bool> {
        match self.conn.query_row(
            "SELECT modified_ns, size_bytes, fs_dirty FROM database_rows WHERE path = ?1",
            params![path],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, u64>(1)?,
                    row.get::<_, i64>(2)?,
                ))
            },
        ) {
            Ok((cached_modified, cached_size, fs_dirty)) => {
                Ok(fs_dirty == 0 && (cached_modified != modified_ns || cached_size != size_bytes))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(true),
            Err(error) => Err(error),
        }
    }

    pub fn upsert_pages(&mut self, pages: &[IndexedPage]) -> rusqlite::Result<()> {
        for page in pages {
            // DB-first: never clobber an unflushed row that already owns this id.
            let dirty_elsewhere: bool = self
                .conn
                .query_row(
                    "SELECT 1 FROM pages WHERE id = ?1 AND path != ?2 AND fs_dirty != 0 LIMIT 1",
                    params![page.id, page.path],
                    |_| Ok(true),
                )
                .optional()?
                .unwrap_or(false);
            if dirty_elsewhere {
                continue;
            }

            // Same logical page may move path (slug rename / leftover files). Drop
            // any other clean row that already owns this id so UNIQUE(id) cannot fail.
            self.conn.execute(
                "DELETE FROM pages WHERE id = ?1 AND path != ?2 AND fs_dirty = 0",
                params![page.id, page.path],
            )?;
            self.conn.execute(
                "INSERT INTO pages (path, id, parent_id, slug, title, icon, content, favorite, modified_ns, size_bytes, fs_dirty)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0)
                 ON CONFLICT(path) DO UPDATE SET
                    id = excluded.id,
                    parent_id = excluded.parent_id,
                    slug = excluded.slug,
                    title = excluded.title,
                    icon = excluded.icon,
                    content = excluded.content,
                    favorite = excluded.favorite,
                    modified_ns = excluded.modified_ns,
                    size_bytes = excluded.size_bytes,
                    fs_dirty = 0
                 WHERE pages.fs_dirty = 0",
                params![
                    page.path,
                    page.id,
                    page.parent_id,
                    page.slug,
                    page.title,
                    page.icon,
                    page.content,
                    page.favorite,
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
                "INSERT INTO databases (path, id, slug, name, content, modified_ns, size_bytes, fs_dirty)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0)
                 ON CONFLICT(path) DO UPDATE SET
                    id = excluded.id,
                    slug = excluded.slug,
                    name = excluded.name,
                    content = excluded.content,
                    modified_ns = excluded.modified_ns,
                    size_bytes = excluded.size_bytes,
                    fs_dirty = 0",
                params![
                    database.path,
                    database.id,
                    database.slug,
                    database.name,
                    database.content,
                    database.modified_ns,
                    database.size_bytes,
                ],
            )?;
        }

        Ok(())
    }

    pub fn upsert_database_rows(&mut self, rows: &[IndexedDatabaseRow]) -> rusqlite::Result<()> {
        for row in rows {
            let dirty_elsewhere: bool = self.conn.query_row(
                "SELECT 1 FROM database_rows WHERE id = ?1 AND path != ?2 AND fs_dirty != 0 LIMIT 1",
                params![row.id, row.path],
                |_| Ok(true),
            ).optional()?.unwrap_or(false);
            if dirty_elsewhere {
                continue;
            }

            self.conn.execute(
                "DELETE FROM database_rows WHERE id = ?1 AND path != ?2 AND fs_dirty = 0",
                params![row.id, row.path],
            )?;
            self.conn.execute(
                "INSERT INTO database_rows (
                    path, database_id, id, slug, title, icon, created, edited,
                    attributes_json, content, favorite, modified_ns, size_bytes, fs_dirty
                 )
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 0)
                 ON CONFLICT(path) DO UPDATE SET
                    database_id = excluded.database_id,
                    id = excluded.id,
                    slug = excluded.slug,
                    title = excluded.title,
                    icon = excluded.icon,
                    created = excluded.created,
                    edited = excluded.edited,
                    attributes_json = excluded.attributes_json,
                    content = excluded.content,
                    favorite = excluded.favorite,
                    modified_ns = excluded.modified_ns,
                    size_bytes = excluded.size_bytes,
                    fs_dirty = 0
                 WHERE database_rows.fs_dirty = 0",
                params![
                    row.path,
                    row.database_id,
                    row.id,
                    row.slug,
                    row.title,
                    row.icon,
                    row.created,
                    row.edited,
                    row.attributes_json,
                    row.content,
                    row.favorite,
                    row.modified_ns,
                    row.size_bytes,
                ],
            )?;
        }

        Ok(())
    }

    pub fn list_database_rows(
        &self,
        database_id: &str,
        limit: usize,
        offset: usize,
        direction: Option<crate::databases::DatabaseSortDirection>,
        sort: &crate::databases::ResolvedDatabaseSort,
    ) -> rusqlite::Result<DatabaseRowsPage> {
        use crate::databases::{DatabaseSortDirection, ResolvedDatabaseSort};

        let limit = limit.clamp(1, 200);
        let total: usize = self.conn.query_row(
            "SELECT COUNT(*) FROM database_rows WHERE database_id = ?1",
            params![database_id],
            |row| row.get::<_, i64>(0).map(|value| value as usize),
        )?;

        let direction = direction.unwrap_or(DatabaseSortDirection::Desc);
        let order = match direction {
            DatabaseSortDirection::Asc => "ASC",
            DatabaseSortDirection::Desc => "DESC",
        };

        let sql = match sort {
            ResolvedDatabaseSort::Edited => format!(
                "SELECT id, slug, title, icon, created, edited, attributes_json, path, favorite
                 FROM database_rows
                 WHERE database_id = ?1
                 ORDER BY COALESCE(edited, '') {order}, id {order}
                 LIMIT ?2 OFFSET ?3"
            ),
            ResolvedDatabaseSort::Title => format!(
                "SELECT id, slug, title, icon, created, edited, attributes_json, path, favorite
                 FROM database_rows
                 WHERE database_id = ?1
                 ORDER BY COALESCE(title, '') COLLATE NOCASE {order}, id {order}
                 LIMIT ?2 OFFSET ?3"
            ),
            ResolvedDatabaseSort::Created => format!(
                "SELECT id, slug, title, icon, created, edited, attributes_json, path, favorite
                 FROM database_rows
                 WHERE database_id = ?1
                 ORDER BY COALESCE(created, '') {order}, id {order}
                 LIMIT ?2 OFFSET ?3"
            ),
            ResolvedDatabaseSort::AttributeExpr(expr) => format!(
                "SELECT id, slug, title, icon, created, edited, attributes_json, path, favorite
                 FROM database_rows
                 WHERE database_id = ?1
                 ORDER BY {expr} {order}, id {order}
                 LIMIT ?2 OFFSET ?3"
            ),
        };

        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt
            .query_map(params![database_id, limit as i64, offset as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, bool>(8)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut summaries = Vec::with_capacity(rows.len());
        for (id, slug, title, icon, created, edited, attributes_json, path, favorite) in rows {
            let attributes =
                serde_json::from_str(&attributes_json).unwrap_or_else(|_| serde_json::json!({}));
            summaries.push(DatabaseRowSummary {
                id,
                slug,
                title,
                icon,
                created,
                edited,
                attributes,
                path,
                database_id: database_id.to_owned(),
                favorite,
            });
        }

        Ok(DatabaseRowsPage {
            has_more: offset + summaries.len() < total,
            rows: summaries,
            total,
            offset,
            limit,
        })
    }

    /// Lists direct children of `parent_id`. When `depth > 1`, each page with
    /// children includes nested `children` recursively up to `depth` levels.
    pub fn list_pages_by_parent(
        &self,
        parent_id: Option<&str>,
        depth: u8,
    ) -> rusqlite::Result<Vec<PageSummary>> {
        let depth = depth.max(1);
        let mut stmt = self.conn.prepare(
            "SELECT id, parent_id, slug, title, icon, path, favorite FROM pages
             WHERE parent_id IS ?1
             ORDER BY COALESCE(title, id) COLLATE NOCASE",
        )?;
        let rows = stmt
            .query_map(params![parent_id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, bool>(6)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut pages = Vec::with_capacity(rows.len());
        for (id, parent_id, slug, title, icon, path, favorite) in rows {
            let has_children = self.page_has_children(&id)?;
            let children = if depth > 1 && has_children {
                Some(self.list_pages_by_parent(Some(&id), depth - 1)?)
            } else {
                None
            };
            pages.push(PageSummary {
                id,
                parent_id,
                slug,
                title,
                icon,
                path,
                has_children,
                favorite,
                database_id: None,
                children,
            });
        }

        Ok(pages)
    }

    pub fn get_page_by_id(&self, id: &str) -> rusqlite::Result<Option<PageDetail>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, parent_id, slug, title, icon, path, content, favorite FROM pages WHERE id = ?1 LIMIT 1",
        )?;
        let row = stmt
            .query_row(params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, bool>(7)?,
                ))
            })
            .optional()?;

        let Some((id, parent_id, slug, title, icon, path, content, favorite)) = row else {
            return Ok(None);
        };

        let has_children = self.page_has_children(&id)?;
        let body = strip_frontmatter(&content).to_owned();
        let body_hash = hash_body(&body);
        let referenced_pages = self.referenced_pages_for_body(&body)?;
        Ok(Some(PageDetail {
            id,
            parent_id: parent_id.clone(),
            slug,
            title,
            icon,
            path,
            has_children,
            favorite,
            database_id: None,
            attributes: None,
            created: None,
            edited: None,
            body,
            body_hash,
            referenced_pages,
            ancestors: self.page_ancestors(parent_id.as_deref())?,
        }))
    }

    /// Resolve internal page links in a body to display metadata for the editor.
    pub fn referenced_pages_for_body(&self, body: &str) -> rusqlite::Result<Vec<ReferencedPage>> {
        let mut out = Vec::new();
        let mut seen = HashSet::new();

        for href in extract_internal_mdx_hrefs(body) {
            let Some(id) = page_id_from_mdx_href(&href) else {
                continue;
            };
            if !seen.insert(id.clone()) {
                continue;
            }

            if let Some(page) = self.get_referenced_page_meta(&id)? {
                out.push(page);
            }
        }

        Ok(out)
    }

    fn get_referenced_page_meta(&self, id: &str) -> rusqlite::Result<Option<ReferencedPage>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, slug, title, icon, path FROM pages WHERE id = ?1 LIMIT 1")?;
        let page = stmt
            .query_row(params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .optional()?;

        if let Some((id, slug, title, icon, path)) = page {
            return Ok(Some(referenced_page_meta(id, slug, title, icon, path)));
        }

        let mut stmt = self.conn.prepare(
            "SELECT id, slug, title, icon, path FROM database_rows WHERE id = ?1 LIMIT 1",
        )?;
        let row = stmt
            .query_row(params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .optional()?;

        Ok(row
            .map(|(id, slug, title, icon, path)| referenced_page_meta(id, slug, title, icon, path)))
    }

    /// Look up a database row by page id (for opening rows as pages).
    pub fn get_database_row_by_id(&self, id: &str) -> rusqlite::Result<Option<DatabaseRowSummary>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, slug, title, icon, created, edited, attributes_json, path, database_id, favorite
             FROM database_rows WHERE id = ?1 LIMIT 1",
        )?;
        let row = stmt
            .query_row(params![id], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, bool>(9)?,
                ))
            })
            .optional()?;

        let Some((
            id,
            slug,
            title,
            icon,
            created,
            edited,
            attributes_json,
            path,
            database_id,
            favorite,
        )) = row
        else {
            return Ok(None);
        };

        let attributes =
            serde_json::from_str(&attributes_json).unwrap_or_else(|_| serde_json::json!({}));
        Ok(Some(DatabaseRowSummary {
            id,
            slug,
            title,
            icon,
            created,
            edited,
            attributes,
            path,
            database_id,
            favorite,
        }))
    }

    pub fn get_database_by_id(&self, id: &str) -> rusqlite::Result<Option<DatabaseMeta>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, slug, name, path FROM databases WHERE id = ?1 LIMIT 1")?;
        let row = stmt
            .query_row(params![id], |row| {
                Ok(DatabaseMeta {
                    id: row.get(0)?,
                    slug: row.get(1)?,
                    name: row.get(2)?,
                    path: row.get(3)?,
                })
            })
            .optional()?;

        Ok(row)
    }

    pub fn get_database_content(&self, id: &str) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT content FROM databases WHERE id = ?1 LIMIT 1",
                params![id],
                |row| row.get(0),
            )
            .optional()
    }

    pub fn get_page_content(&self, id: &str) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT content FROM pages WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()
    }

    /// Upserts a mutable page. Returns the previous path when it changed (caller
    /// should schedule deletion of the old backup file).
    pub fn upsert_page_mutable(
        &mut self,
        path: &str,
        id: &str,
        parent_id: Option<&str>,
        slug: Option<&str>,
        title: Option<&str>,
        icon: Option<&str>,
        content: &str,
        favorite: bool,
    ) -> rusqlite::Result<Option<String>> {
        let old_path: Option<String> = self
            .conn
            .query_row("SELECT path FROM pages WHERE id = ?1", params![id], |row| {
                row.get(0)
            })
            .optional()?;

        self.conn.execute(
            "INSERT INTO pages (path, id, parent_id, slug, title, icon, content, favorite, modified_ns, size_bytes, fs_dirty)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, 0, 1)
             ON CONFLICT(id) DO UPDATE SET path=excluded.path, parent_id=excluded.parent_id,
             slug=excluded.slug, title=excluded.title, icon=excluded.icon, content=excluded.content,
             favorite=excluded.favorite, fs_dirty=1",
            params![path, id, parent_id, slug, title, icon, content, favorite],
        )?;

        Ok(old_path.filter(|previous| previous != path))
    }

    /// All descendant page ids under `id` (not including `id`), depth-first.
    pub fn descendant_page_ids(&self, id: &str) -> rusqlite::Result<Vec<String>> {
        let mut out = Vec::new();
        let mut stack = vec![id.to_owned()];
        while let Some(current) = stack.pop() {
            let children = self.list_pages_by_parent(Some(&current), 1)?;
            for child in children {
                stack.push(child.id.clone());
                out.push(child.id);
            }
        }
        Ok(out)
    }

    pub fn upsert_database_content(&mut self, id: &str, content: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "UPDATE databases SET content = ?1, fs_dirty = 1 WHERE id = ?2",
            params![content, id],
        )?;
        Ok(())
    }

    /// Upserts a mutable database row. Returns the previous path when it changed
    /// (caller should schedule deletion of the old file).
    pub fn upsert_database_row_mutable(
        &mut self,
        path: &str,
        database_id: &str,
        id: &str,
        slug: Option<&str>,
        title: Option<&str>,
        icon: Option<&str>,
        content: &str,
        favorite: bool,
    ) -> rusqlite::Result<Option<String>> {
        let old_path: Option<String> = self
            .conn
            .query_row(
                "SELECT path FROM database_rows WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .optional()?;

        let (created, edited, attributes_json) = parse_row_cache_fields(content);
        self.conn.execute(
            "INSERT INTO database_rows (path, database_id, id, slug, title, icon, created, edited, attributes_json, content, favorite, modified_ns, size_bytes, fs_dirty)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, 0, 1)
             ON CONFLICT(id) DO UPDATE SET path=excluded.path, database_id=excluded.database_id,
             slug=excluded.slug, title=excluded.title, icon=excluded.icon,
             created=excluded.created, edited=excluded.edited,
             attributes_json=excluded.attributes_json, content=excluded.content,
             favorite=excluded.favorite, fs_dirty=1",
            params![
                path,
                database_id,
                id,
                slug,
                title,
                icon,
                created,
                edited,
                attributes_json,
                content,
                favorite
            ],
        )?;
        Ok(old_path.filter(|previous| previous != path))
    }

    pub fn get_database_row_content(&self, id: &str) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT content FROM database_rows WHERE id=?1",
                params![id],
                |row| row.get(0),
            )
            .optional()
    }

    pub fn delete_page_by_id(&mut self, id: &str) -> rusqlite::Result<usize> {
        self.conn
            .execute("DELETE FROM pages WHERE id = ?1", params![id])
    }

    pub fn delete_database_row_by_id(&mut self, id: &str) -> rusqlite::Result<usize> {
        self.conn
            .execute("DELETE FROM database_rows WHERE id = ?1", params![id])
    }

    /// Strip inbound body links to `page_ids` from pages and database rows.
    /// Returns `(updated_page_ids, updated_row_ids)`.
    pub fn remove_links_to_page_ids(
        &mut self,
        page_ids: &HashSet<String>,
    ) -> rusqlite::Result<(Vec<String>, Vec<String>)> {
        if page_ids.is_empty() {
            return Ok((Vec::new(), Vec::new()));
        }

        let mut page_candidates: HashSet<String> = HashSet::new();
        let mut row_candidates: HashSet<String> = HashSet::new();

        for target_id in page_ids {
            let pattern = format!("%{}-%", escape_like(target_id));
            {
                let mut stmt = self.conn.prepare(
                    "SELECT id FROM pages WHERE content LIKE ?1 ESCAPE '\\' COLLATE NOCASE",
                )?;
                let ids = stmt.query_map(params![pattern], |row| row.get::<_, String>(0))?;
                for id in ids {
                    page_candidates.insert(id?);
                }
            }
            {
                let mut stmt = self.conn.prepare(
                    "SELECT id FROM database_rows WHERE content LIKE ?1 ESCAPE '\\' COLLATE NOCASE",
                )?;
                let ids = stmt.query_map(params![pattern], |row| row.get::<_, String>(0))?;
                for id in ids {
                    row_candidates.insert(id?);
                }
            }
        }

        let mut updated_pages = Vec::new();
        let mut updated_rows = Vec::new();

        for id in page_candidates {
            let Some(content) = self.get_page_content(&id)? else {
                continue;
            };
            let body = strip_frontmatter(&content);
            let new_body = strip_links_to_page_ids(body, page_ids);
            if new_body == body {
                continue;
            }
            let new_content = replace_body_preserving_frontmatter(&content, &new_body);
            self.conn.execute(
                "UPDATE pages SET content = ?1, fs_dirty = 1 WHERE id = ?2",
                params![new_content, id],
            )?;
            updated_pages.push(id);
        }

        for id in row_candidates {
            let Some(content) = self.get_database_row_content(&id)? else {
                continue;
            };
            let body = strip_frontmatter(&content);
            let new_body = strip_links_to_page_ids(body, page_ids);
            if new_body == body {
                continue;
            }
            let new_content = replace_body_preserving_frontmatter(&content, &new_body);
            self.conn.execute(
                "UPDATE database_rows SET content = ?1, fs_dirty = 1 WHERE id = ?2",
                params![new_content, id],
            )?;
            updated_rows.push(id);
        }

        Ok((updated_pages, updated_rows))
    }

    pub fn dirty_pages(&self) -> rusqlite::Result<Vec<(String, String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, path, content FROM pages WHERE fs_dirty != 0")?;
        let rows = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
            .collect();
        rows
    }

    pub fn dirty_databases(&self) -> rusqlite::Result<Vec<(String, String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, path, content FROM databases WHERE fs_dirty != 0")?;
        let rows = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
            .collect();
        rows
    }

    pub fn dirty_database_rows(&self) -> rusqlite::Result<Vec<(String, String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, path, content FROM database_rows WHERE fs_dirty != 0")?;
        let rows = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
            .collect();
        rows
    }

    pub fn clear_page_dirty(&mut self, id: &str) -> rusqlite::Result<()> {
        self.conn
            .execute("UPDATE pages SET fs_dirty = 0 WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn clear_database_dirty(&mut self, id: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "UPDATE databases SET fs_dirty = 0 WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn clear_database_row_dirty(&mut self, id: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "UPDATE database_rows SET fs_dirty = 0 WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }

    pub fn list_favorite_pages(&self) -> rusqlite::Result<Vec<PageSummary>> {
        // Compound SELECTs cannot ORDER BY expressions like COALESCE(...);
        // wrap in a subquery so title/id sorting works.
        let mut stmt = self.conn.prepare(
            "SELECT id, parent_id, slug, title, icon, path, database_id FROM (
                 SELECT id, parent_id, slug, title, icon, path, NULL AS database_id
                 FROM pages WHERE favorite = 1
                 UNION ALL
                 SELECT id, NULL, slug, title, icon, path, database_id
                 FROM database_rows WHERE favorite = 1
             )
             ORDER BY COALESCE(title, id) COLLATE NOCASE",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(PageSummary {
                id: row.get(0)?,
                parent_id: row.get(1)?,
                slug: row.get(2)?,
                title: row.get(3)?,
                icon: row.get(4)?,
                path: row.get(5)?,
                has_children: false,
                favorite: true,
                database_id: row.get(6)?,
                children: None,
            })
        })?;
        rows.collect()
    }

    pub fn search_pages(&self, query: &str, limit: usize) -> rusqlite::Result<Vec<SearchPageHit>> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(Vec::new());
        }

        let limit = limit.clamp(1, 100);
        let pattern = format!("%{}%", escape_like(query));

        let mut page_stmt = self.conn.prepare(
            "SELECT id, parent_id, slug, title, icon, path, content, favorite FROM pages
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

        let page_rows = page_stmt
            .query_map(params![pattern, limit as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, bool>(7)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        let mut hits = Vec::with_capacity(page_rows.len() + limit);
        for (id, parent_id, slug, title, icon, path, content, favorite) in page_rows {
            let (match_in, snippet) =
                classify_match(query, title.as_deref(), slug.as_deref(), &content);
            let has_children = self.page_has_children(&id)?;
            hits.push(SearchPageHit {
                id,
                parent_id,
                slug,
                title,
                icon,
                path,
                has_children,
                favorite,
                match_in,
                snippet,
            });
        }

        let mut row_stmt = self.conn.prepare(
            "SELECT id, slug, title, icon, path, content, attributes_json, favorite FROM database_rows
             WHERE title LIKE ?1 ESCAPE '\\' COLLATE NOCASE
                OR slug LIKE ?1 ESCAPE '\\' COLLATE NOCASE
                OR content LIKE ?1 ESCAPE '\\' COLLATE NOCASE
                OR attributes_json LIKE ?1 ESCAPE '\\' COLLATE NOCASE
             ORDER BY
               CASE
                 WHEN title LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 0
                 WHEN slug LIKE ?1 ESCAPE '\\' COLLATE NOCASE THEN 1
                 ELSE 2
               END,
               COALESCE(title, id) COLLATE NOCASE
             LIMIT ?2",
        )?;

        let row_rows = row_stmt
            .query_map(params![pattern, limit as i64], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, bool>(7)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;

        for (id, slug, title, icon, path, content, attributes_json, favorite) in row_rows {
            let (match_in, snippet) = classify_database_row_match(
                query,
                title.as_deref(),
                slug.as_deref(),
                &content,
                &attributes_json,
            );
            hits.push(SearchPageHit {
                id,
                parent_id: None,
                slug,
                title,
                icon,
                path,
                has_children: false,
                favorite,
                match_in,
                snippet,
            });
        }

        hits.sort_by(|a, b| {
            match_rank(&a.match_in)
                .cmp(&match_rank(&b.match_in))
                .then_with(|| {
                    let a_label = a.title.as_deref().unwrap_or(&a.id);
                    let b_label = b.title.as_deref().unwrap_or(&b.id);
                    a_label.to_lowercase().cmp(&b_label.to_lowercase())
                })
        });
        hits.truncate(limit);

        Ok(hits)
    }

    fn page_has_children(&self, id: &str) -> rusqlite::Result<bool> {
        self.conn.query_row(
            "SELECT EXISTS(
                SELECT 1 FROM pages
                WHERE parent_id = ?1
             )",
            params![id],
            |row| row.get(0),
        )
    }

    fn page_ancestors(&self, parent_id: Option<&str>) -> rusqlite::Result<Vec<PageSummary>> {
        let mut ancestors = Vec::new();
        let mut current = parent_id.map(str::to_owned);
        while let Some(id) = current {
            let row = self.conn.query_row(
                "SELECT id, parent_id, slug, title, icon, path, favorite FROM pages WHERE id = ?1",
                params![id],
                |row| Ok(PageSummary {
                    id: row.get(0)?,
                    parent_id: row.get(1)?,
                    slug: row.get(2)?,
                    title: row.get(3)?,
                    icon: row.get(4)?,
                    path: row.get(5)?,
                    has_children: true,
                    favorite: row.get(6)?,
                    database_id: None,
                    children: None,
                }),
            ).optional()?;
            let Some(page) = row else { break };
            current = page.parent_id.clone();
            ancestors.push(page);
        }
        ancestors.reverse();
        Ok(ancestors)
    }

    pub fn delete_pages_not_in(&mut self, paths: &HashSet<String>) -> rusqlite::Result<usize> {
        delete_rows_not_in(&self.conn, "pages", paths)
    }

    pub fn delete_databases_not_in(&mut self, paths: &HashSet<String>) -> rusqlite::Result<usize> {
        delete_rows_not_in(&self.conn, "databases", paths)
    }

    pub fn delete_database_rows_not_in(
        &mut self,
        paths: &HashSet<String>,
    ) -> rusqlite::Result<usize> {
        delete_rows_not_in(&self.conn, "database_rows", paths)
    }
}

fn delete_rows_not_in(
    conn: &Connection,
    table: &str,
    paths: &HashSet<String>,
) -> rusqlite::Result<usize> {
    if paths.is_empty() {
        return conn
            .execute(&format!("DELETE FROM {table} WHERE fs_dirty = 0"), [])
            .map(|count| count as usize);
    }

    let mut removed = 0usize;
    let mut stmt = conn.prepare(&format!("SELECT path FROM {table} WHERE fs_dirty = 0"))?;
    let existing = stmt
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    for path in existing {
        if paths.contains(&path) {
            continue;
        }

        removed += conn.execute(
            &format!("DELETE FROM {table} WHERE path = ?1 AND fs_dirty = 0"),
            params![path],
        )? as usize;
    }

    Ok(removed)
}

fn schema_is_current(conn: &Connection) -> bool {
    conn.prepare("SELECT modified_ns, size_bytes, parent_id, favorite, fs_dirty FROM pages LIMIT 0")
        .is_ok()
        && conn
            .prepare("SELECT modified_ns, size_bytes, content, fs_dirty FROM databases LIMIT 0")
            .is_ok()
        && conn
            .prepare("SELECT content, favorite, fs_dirty FROM database_rows LIMIT 0")
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

        version.is_none_or(|version| version < CACHE_DB_VERSION) || !schema_is_current(&conn)
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

pub fn parent_id_from_page_path(path: &str) -> Option<String> {
    let parent = Path::new(path)
        .parent()?
        .to_string_lossy()
        .replace('\\', "/");
    if parent == "pages" {
        None
    } else {
        parent
            .rsplit('/')
            .next()
            .filter(|id| !id.is_empty())
            .map(str::to_owned)
    }
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

fn extract_frontmatter_yaml(content: &str) -> Option<&str> {
    let content = content.trim_start();
    let rest = content.strip_prefix("---")?;
    let end = rest.find("\n---")?;
    Some(&rest[..end])
}

/// Parse `created`, `edited`, and `attributes_json` from row MDX content for cache upserts.
pub(crate) fn parse_row_cache_fields(content: &str) -> (Option<String>, Option<String>, String) {
    let yaml = extract_frontmatter_yaml(content).unwrap_or("");
    let value: serde_yaml::Value = if yaml.trim().is_empty() {
        serde_yaml::Value::Mapping(serde_yaml::Mapping::new())
    } else {
        serde_yaml::from_str(yaml).unwrap_or(serde_yaml::Value::Mapping(serde_yaml::Mapping::new()))
    };

    let mapping = value.as_mapping();
    let created = mapping
        .and_then(|map| map.get(serde_yaml::Value::String("created".into())))
        .and_then(yaml_scalar_to_string);
    let edited = mapping
        .and_then(|map| map.get(serde_yaml::Value::String("edited".into())))
        .and_then(yaml_scalar_to_string);
    let properties = mapping
        .and_then(|map| map.get(serde_yaml::Value::String("properties".into())))
        .cloned()
        .unwrap_or(serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));
    let attributes_json = serde_json::to_string(&yaml_value_to_json(properties))
        .unwrap_or_else(|_| "{}".to_owned());

    (created, edited, attributes_json)
}

fn yaml_scalar_to_string(value: &serde_yaml::Value) -> Option<String> {
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

fn yaml_value_to_json(value: serde_yaml::Value) -> serde_json::Value {
    serde_json::to_value(value).unwrap_or(serde_json::Value::Null)
}

/** Body text of an `.mdx` page/row file (frontmatter stripped). */
pub fn page_body_from_content(content: &str) -> String {
    strip_frontmatter(content).to_owned()
}

/// SHA-256 hex prefix of the page body UTF-8 bytes (10 chars).
pub const BODY_HASH_LEN: usize = 10;

/// Truncated SHA-256 hex digest of the page body UTF-8 bytes.
pub fn hash_body(body: &str) -> String {
    use sha2::{Digest, Sha256};
    let full = hex::encode(Sha256::digest(body.as_bytes()));
    full[..BODY_HASH_LEN].to_owned()
}

fn referenced_page_meta(
    id: String,
    slug: Option<String>,
    title: Option<String>,
    icon: Option<String>,
    path: String,
) -> ReferencedPage {
    let name = title
        .filter(|value| !value.is_empty())
        .or_else(|| slug.clone().filter(|value| !value.is_empty()))
        .unwrap_or_else(|| id.clone());
    ReferencedPage {
        id,
        name,
        icon,
        link: path,
    }
}

/// Collect unique `.mdx` hrefs from markdown `[…](href)` and HTML `href="…"` links.
pub fn extract_internal_mdx_hrefs(body: &str) -> Vec<String> {
    let mut hrefs = Vec::new();
    let mut seen = HashSet::new();

    let mut push_href = |raw: &str| {
        let href = normalize_mdx_href(raw);
        if href.is_empty() || !is_internal_mdx_href(&href) {
            return;
        }
        if seen.insert(href.clone()) {
            hrefs.push(href);
        }
    };

    // Markdown links: [label](href) and [label](<href>)
    let mut rest = body;
    while let Some(start) = rest.find("](") {
        rest = &rest[start + 2..];
        let href = if let Some(stripped) = rest.strip_prefix('<') {
            match stripped.find('>') {
                Some(end) => {
                    let value = &stripped[..end];
                    rest = &stripped[end + 1..];
                    value
                }
                None => continue,
            }
        } else {
            match rest.find(')') {
                Some(end) => {
                    let value = &rest[..end];
                    rest = &rest[end + 1..];
                    value
                }
                None => break,
            }
        };
        push_href(href.trim());
    }

    // HTML / MDX anchors: href="…" or href='…'
    for quote in ['"', '\''] {
        let needle = format!("href={quote}");
        let mut html_rest = body;
        while let Some(start) = html_rest.find(&needle) {
            html_rest = &html_rest[start + needle.len()..];
            match html_rest.find(quote) {
                Some(end) => {
                    push_href(html_rest[..end].trim());
                    html_rest = &html_rest[end + 1..];
                }
                None => break,
            }
        }
    }

    hrefs
}

fn normalize_mdx_href(href: &str) -> String {
    href.trim()
        .trim_start_matches("./")
        .trim_start_matches('/')
        .to_owned()
}

fn is_internal_mdx_href(href: &str) -> bool {
    if href.is_empty() || !href.ends_with(".mdx") {
        return false;
    }
    if href.contains("://") {
        return false;
    }
    // Reject scheme-like paths (e.g. javascript:…mdx).
    let before_slash = href.split('/').next().unwrap_or(href);
    if before_slash.contains(':') {
        return false;
    }
    true
}

/// Page id from an internal `.mdx` href stem (`{id}-{slug}.mdx`).
pub fn page_id_from_mdx_href(href: &str) -> Option<String> {
    let normalized = normalize_mdx_href(href);
    if !is_internal_mdx_href(&normalized) {
        return None;
    }
    let stem = Path::new(&normalized)
        .file_stem()
        .and_then(|value| value.to_str())?;
    let (id, _slug) = stem.split_once('-')?;
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some(id.to_ascii_lowercase())
}

/// Replace markdown/HTML links pointing at any of `page_ids` with their link text.
pub fn strip_links_to_page_ids(body: &str, page_ids: &HashSet<String>) -> String {
    if page_ids.is_empty() || !body.contains(".mdx") {
        return body.to_owned();
    }
    let without_markdown = strip_markdown_links_to_page_ids(body, page_ids);
    strip_html_anchors_to_page_ids(&without_markdown, page_ids)
}

fn href_targets_page_id(href: &str, page_ids: &HashSet<String>) -> bool {
    page_id_from_mdx_href(href).is_some_and(|id| page_ids.contains(&id))
}

fn strip_markdown_links_to_page_ids(body: &str, page_ids: &HashSet<String>) -> String {
    let mut out = String::with_capacity(body.len());
    let mut rest = body;

    while let Some(close_rel) = rest.find("](") {
        let before = &rest[..close_rel];
        let Some(open_rel) = before.rfind('[') else {
            out.push_str(&rest[..=close_rel]);
            rest = &rest[close_rel + 1..];
            continue;
        };

        let after_paren = &rest[close_rel + 2..];
        let (href, consumed) = if let Some(stripped) = after_paren.strip_prefix('<') {
            match stripped.find('>') {
                Some(end) => {
                    let href = &stripped[..end];
                    let after_gt = &stripped[end + 1..];
                    let trailing_paren = usize::from(after_gt.starts_with(')'));
                    (href, 1 + end + 1 + trailing_paren)
                }
                None => {
                    out.push_str(&rest[..=close_rel + 1]);
                    rest = &rest[close_rel + 2..];
                    continue;
                }
            }
        } else {
            match after_paren.find(')') {
                Some(end) => (&after_paren[..end], end + 1),
                None => {
                    out.push_str(rest);
                    return out;
                }
            }
        };

        let label = &before[open_rel + 1..];
        out.push_str(&before[..open_rel]);
        if href_targets_page_id(href.trim(), page_ids) {
            out.push_str(label);
        } else {
            out.push('[');
            out.push_str(label);
            out.push_str("](");
            out.push_str(&after_paren[..consumed]);
        }
        rest = &after_paren[consumed..];
    }

    out.push_str(rest);
    out
}

fn strip_html_anchors_to_page_ids(body: &str, page_ids: &HashSet<String>) -> String {
    let mut out = String::with_capacity(body.len());
    let mut rest = body;

    while let Some(start_rel) = find_anchor_open(rest) {
        out.push_str(&rest[..start_rel]);
        let from_tag = &rest[start_rel..];
        let Some(tag_end) = from_tag.find('>') else {
            out.push_str(from_tag);
            return out;
        };
        let open_tag = &from_tag[..=tag_end];
        let after_open = &from_tag[tag_end + 1..];

        if open_tag.trim_end().ends_with("/>") {
            // Self-closing <a … />
            if anchor_open_targets_page_id(open_tag, page_ids) {
                // Drop the empty link entirely.
            } else {
                out.push_str(open_tag);
            }
            rest = after_open;
            continue;
        }

        let Some(close_rel) = find_ignore_case(after_open, "</a>") else {
            out.push_str(from_tag);
            return out;
        };
        let inner = &after_open[..close_rel];
        let after_close = &after_open[close_rel + 4..];

        if anchor_open_targets_page_id(open_tag, page_ids) {
            out.push_str(inner);
        } else {
            out.push_str(open_tag);
            out.push_str(inner);
            out.push_str("</a>");
        }
        rest = after_close;
    }

    out.push_str(rest);
    out
}

fn find_anchor_open(haystack: &str) -> Option<usize> {
    let lower = haystack.to_ascii_lowercase();
    let mut search_from = 0;
    while let Some(rel) = lower[search_from..].find("<a") {
        let abs = search_from + rel;
        let after = haystack.as_bytes().get(abs + 2).copied();
        if after.is_none_or(|byte| byte.is_ascii_whitespace() || byte == b'>') {
            return Some(abs);
        }
        search_from = abs + 2;
    }
    None
}

fn find_ignore_case(haystack: &str, needle: &str) -> Option<usize> {
    haystack.to_ascii_lowercase().find(&needle.to_ascii_lowercase())
}

fn anchor_open_targets_page_id(open_tag: &str, page_ids: &HashSet<String>) -> bool {
    for quote in ['"', '\''] {
        let needle = format!("href={quote}");
        let lower_tag = open_tag.to_ascii_lowercase();
        let lower_needle = needle.to_ascii_lowercase();
        if let Some(start) = lower_tag.find(&lower_needle) {
            let value_start = start + needle.len();
            if let Some(end_rel) = open_tag[value_start..].find(quote) {
                let href = open_tag[value_start..value_start + end_rel].trim();
                if href_targets_page_id(href, page_ids) {
                    return true;
                }
            }
        }
    }
    false
}

/// Replace the MDX body while keeping YAML frontmatter bytes intact.
pub fn replace_body_preserving_frontmatter(content: &str, new_body: &str) -> String {
    let new_body = new_body.trim_end_matches(['\n', '\r']);
    let trimmed_start = content.len() - content.trim_start().len();
    let trimmed = &content[trimmed_start..];
    if let Some(rest) = trimmed.strip_prefix("---") {
        if let Some(end) = rest.find("\n---") {
            let close_end = trimmed_start + 3 + end + 4;
            let after_close = &content[close_end..];
            let body_trim = after_close.len() - after_close.trim_start().len();
            let body_start = close_end + body_trim;
            let mut out = content[..body_start].to_owned();
            out.push_str(new_body);
            if !new_body.is_empty() {
                out.push('\n');
            }
            return out;
        }
    }

    let mut out = new_body.to_owned();
    if !new_body.is_empty() {
        out.push('\n');
    }
    out
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

fn match_rank(match_in: &str) -> u8 {
    match match_in {
        "title" => 0,
        "slug" => 1,
        _ => 2,
    }
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

fn classify_database_row_match(
    query: &str,
    title: Option<&str>,
    slug: Option<&str>,
    content: &str,
    attributes_json: &str,
) -> (String, Option<String>) {
    if title.is_some_and(|title| contains_nocase(title, query)) {
        return ("title".to_owned(), None);
    }
    if slug.is_some_and(|slug| contains_nocase(slug, query)) {
        return ("slug".to_owned(), None);
    }

    let body = strip_frontmatter(content);
    if contains_nocase(body, query) {
        return ("body".to_owned(), make_snippet(body, query));
    }
    ("body".to_owned(), make_snippet(attributes_json, query))
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
            trimmed == ENTRY
                || trimmed == ".fibbelous"
                || trimmed == "**/.fibbelous/"
                || trimmed == "**/.fibbelous"
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

#[cfg(test)]
mod tests {
    use super::*;

    fn ids(values: &[&str]) -> HashSet<String> {
        values.iter().map(|value| (*value).to_owned()).collect()
    }

    #[test]
    fn strip_markdown_page_links_keeps_label() {
        let body = "See [Notes](pages/abcdef12-notes.mdx) and [Keep](pages/12345678-keep.mdx).";
        let stripped = strip_links_to_page_ids(body, &ids(&["abcdef12"]));
        assert_eq!(stripped, "See Notes and [Keep](pages/12345678-keep.mdx).");
    }

    #[test]
    fn strip_markdown_angle_href_page_links() {
        let body = "Go [Home](<./abcdef12-home.mdx>) please.";
        let stripped = strip_links_to_page_ids(body, &ids(&["abcdef12"]));
        assert_eq!(stripped, "Go Home please.");
    }

    #[test]
    fn strip_html_page_anchors_keeps_inner_text() {
        let body = r#"Hello <a href="pages/abcdef12-notes.mdx">Notes</a> world."#;
        let stripped = strip_links_to_page_ids(body, &ids(&["abcdef12"]));
        assert_eq!(stripped, "Hello Notes world.");
    }

    #[test]
    fn strip_leaves_unrelated_links_alone() {
        let body = r#"[Ext](https://example.com) and <a href="pages/12345678-keep.mdx">Keep</a>"#;
        let stripped = strip_links_to_page_ids(body, &ids(&["abcdef12"]));
        assert_eq!(stripped, body);
    }

    #[test]
    fn replace_body_preserves_frontmatter() {
        let content = "---\nid: abc\ntitle: Test\n---\n\nOld body\n";
        let replaced = replace_body_preserving_frontmatter(content, "New body");
        assert_eq!(replaced, "---\nid: abc\ntitle: Test\n---\n\nNew body\n");
    }
}


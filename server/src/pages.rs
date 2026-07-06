use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::cache::{CacheDb, PageDetail, children_dir};
use crate::index::sync_workspace;

const TRASH_ROOT: &str = ".fibbelous/trash";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashedPageDetail {
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub original_path: String,
    pub trashed_at: String,
    pub has_children: bool,
    pub body: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashedPageSummary {
    pub id: String,
    pub slug: Option<String>,
    pub title: Option<String>,
    pub icon: Option<String>,
    pub original_path: String,
    pub trashed_at: String,
    pub has_children: bool,
}

#[derive(Debug)]
pub struct CreatePageInput {
    pub parent_path: String,
    pub title: Option<String>,
    pub slug: Option<String>,
    pub icon: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug)]
pub struct UpdatePageInput {
    pub id: String,
    pub title: Option<String>,
    pub slug: Option<String>,
    pub icon: Option<String>,
    pub body: Option<String>,
}

fn generate_page_id(salt: &str) -> String {
    let mut hasher = DefaultHasher::new();
    SystemTime::now().hash(&mut hasher);
    salt.hash(&mut hasher);
    format!("{:08x}", hasher.finish() as u32)
}

fn slugify(text: &str) -> String {
    text.to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn file_stem_slug(slug: &str) -> String {
    let slug = slugify(slug);
    if slug.is_empty() {
        "page".to_owned()
    } else {
        slug
    }
}

fn format_page_content(
    id: &str,
    slug: &str,
    title: &str,
    icon: Option<&str>,
    body: &str,
) -> String {
    let mut content = format!("---\nid: {id}\nslug: {slug}\ntitle: {title}\n");
    if let Some(icon) = icon.filter(|value| !value.is_empty()) {
        content.push_str(&format!("icon: {icon}\n"));
    }
    content.push_str("---\n\n");
    content.push_str(body);
    if !body.is_empty() && !body.ends_with('\n') {
        content.push('\n');
    }
    content
}

fn sync(workspace_path: &Path, cache: &mut CacheDb) -> Result<(), String> {
    sync_workspace(workspace_path, cache).map_err(|error| error.to_string())?;
    Ok(())
}

fn get_page_or_err(cache: &CacheDb, id: &str) -> Result<PageDetail, String> {
    cache
        .get_page_by_id(id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "page not found".to_string())
}

pub fn create_page(
    workspace_path: &Path,
    cache: &mut CacheDb,
    input: CreatePageInput,
) -> Result<PageDetail, String> {
    let title = input
        .title
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Untitled".to_owned());
    let mut slug = input
        .slug
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| slugify(&title));
    if slug.is_empty() {
        slug = "untitled".to_owned();
    }
    let body = input.body.unwrap_or_default();
    let icon = input.icon;

    let id = generate_page_id(&format!("{}:{slug}", input.parent_path));
    let file_slug = file_stem_slug(&slug);

    let parent_dir = workspace_path.join(&input.parent_path);
    fs::create_dir_all(&parent_dir).map_err(|error| error.to_string())?;

    let file_path = parent_dir.join(format!("{id}-{file_slug}.mdx"));
    let content = format_page_content(&id, &file_slug, &title, icon.as_deref(), &body);
    fs::write(&file_path, content).map_err(|error| error.to_string())?;

    sync(workspace_path, cache)?;
    get_page_or_err(cache, &id)
}

pub fn update_page(
    workspace_path: &Path,
    cache: &mut CacheDb,
    input: UpdatePageInput,
) -> Result<PageDetail, String> {
    let existing = get_page_or_err(cache, &input.id)?;
    let title_updated = input.title.is_some();

    let title = input
        .title
        .or(existing.title)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Untitled".to_owned());
    let slug = if let Some(slug) = input.slug.filter(|value| !value.is_empty()) {
        slug
    } else if title_updated {
        let derived = slugify(&title);
        if derived.is_empty() {
            existing
                .slug
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| existing.id.clone())
        } else {
            derived
        }
    } else {
        existing
            .slug
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| existing.id.clone())
    };
    let icon = input.icon.or(existing.icon);
    let body = input.body.unwrap_or(existing.body);

    let file_slug = file_stem_slug(&slug);

    let old_path = workspace_path.join(&existing.path);
    let parent_dir = old_path
        .parent()
        .ok_or_else(|| "invalid page path".to_string())?;
    let new_path = parent_dir.join(format!("{}-{}.mdx", input.id, file_slug));

    let content = format_page_content(&input.id, &file_slug, &title, icon.as_deref(), &body);
    fs::write(&new_path, &content).map_err(|error| error.to_string())?;

    if new_path != old_path && old_path.is_file() {
        fs::remove_file(&old_path).map_err(|error| error.to_string())?;
    }

    sync(workspace_path, cache)?;
    get_page_or_err(cache, &input.id)
}

pub fn trash_page(
    workspace_path: &Path,
    cache: &mut CacheDb,
    id: &str,
) -> Result<Vec<String>, String> {
    let existing = get_page_or_err(cache, id)?;
    let mut trashed_ids = vec![existing.id.clone()];

    let children_rel = children_dir(&existing.path, &existing.id);
    let children_fs = workspace_path.join(&children_rel);
    if children_fs.is_dir() {
        for mdx in walk_mdx_files(&children_fs)? {
            trashed_ids.push(page_id_from_mdx(&mdx)?);
        }
    }

    move_to_trash(workspace_path, &existing.path)?;
    if children_fs.is_dir() {
        move_to_trash(workspace_path, &children_rel)?;
    }

    sync(workspace_path, cache)?;
    Ok(trashed_ids)
}

pub fn list_trashed_pages(workspace_path: &Path) -> Result<Vec<TrashedPageSummary>, String> {
    let trash_pages = trash_root(workspace_path).join("pages");
    if !trash_pages.is_dir() {
        return Ok(Vec::new());
    }

    let mut pages = Vec::new();
    for mdx in walk_mdx_files(&trash_pages)? {
        let relative = path_relative_to_workspace(workspace_path, &mdx);
        let Some(original_path) = relative.strip_prefix(&format!("{TRASH_ROOT}/")) else {
            continue;
        };

        let content = fs::read_to_string(&mdx).map_err(|error| error.to_string())?;
        let frontmatter = parse_frontmatter(&content);
        let id = frontmatter
            .get("id")
            .cloned()
            .unwrap_or_else(|| file_stem_id(&mdx));

        let trashed_at = fs::metadata(&mdx)
            .ok()
            .and_then(|metadata| metadata.modified().ok())
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs().to_string())
            .unwrap_or_default();

        let child_trash_dir = trash_pages.join(&id);
        let has_children = child_trash_dir.is_dir()
            && walk_mdx_files(&child_trash_dir)
                .map(|files| !files.is_empty())
                .unwrap_or(false);

        pages.push(TrashedPageSummary {
            id,
            slug: frontmatter.get("slug").cloned(),
            title: frontmatter.get("title").cloned(),
            icon: frontmatter.get("icon").cloned(),
            original_path: original_path.to_owned(),
            trashed_at,
            has_children,
        });
    }

    pages.sort_by(|left, right| {
        left.title
            .as_deref()
            .unwrap_or(left.id.as_str())
            .to_lowercase()
            .cmp(
                &right
                    .title
                    .as_deref()
                    .unwrap_or(right.id.as_str())
                    .to_lowercase(),
            )
    });

    Ok(pages)
}

pub fn get_trashed_page(workspace_path: &Path, id: &str) -> Result<TrashedPageDetail, String> {
    let summary = find_trashed_summary_by_id(workspace_path, id)?;
    let trash_file = trash_root(workspace_path).join(&summary.original_path);
    let content = fs::read_to_string(&trash_file).map_err(|error| error.to_string())?;

    Ok(TrashedPageDetail {
        id: summary.id,
        slug: summary.slug,
        title: summary.title,
        icon: summary.icon,
        original_path: summary.original_path,
        trashed_at: summary.trashed_at,
        has_children: summary.has_children,
        body: strip_frontmatter(&content).to_owned(),
    })
}

pub fn restore_page(
    workspace_path: &Path,
    cache: &mut CacheDb,
    id: &str,
) -> Result<PageDetail, String> {
    let trashed = find_trashed_summary_by_id(workspace_path, id)?;
    restore_from_trash(workspace_path, &trashed.original_path)?;

    let children_rel = children_dir(&trashed.original_path, &trashed.id);
    let child_trash = trash_root(workspace_path).join(&children_rel);
    if child_trash.is_dir() {
        restore_from_trash(workspace_path, &children_rel)?;
    }

    sync(workspace_path, cache)?;
    get_page_or_err(cache, id)
}

pub fn purge_page(workspace_path: &Path, id: &str) -> Result<(), String> {
    let trashed = find_trashed_summary_by_id(workspace_path, id)?;
    let trash_file = trash_root(workspace_path).join(&trashed.original_path);
    if trash_file.is_file() {
        fs::remove_file(&trash_file).map_err(|error| error.to_string())?;
    }

    let children_rel = children_dir(&trashed.original_path, &trashed.id);
    let child_trash = trash_root(workspace_path).join(&children_rel);
    if child_trash.is_dir() {
        fs::remove_dir_all(&child_trash).map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn trash_root(workspace_path: &Path) -> PathBuf {
    workspace_path.join(TRASH_ROOT)
}

fn move_to_trash(workspace_path: &Path, relative_path: &str) -> Result<(), String> {
    let source = workspace_path.join(relative_path);
    if !source.exists() {
        return Ok(());
    }

    let dest = trash_root(workspace_path).join(relative_path);
    if dest.exists() {
        return Err(format!("path already in trash: {relative_path}"));
    }

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::rename(&source, &dest).map_err(|error| error.to_string())
}

fn restore_from_trash(workspace_path: &Path, relative_path: &str) -> Result<(), String> {
    let trash_path = trash_root(workspace_path).join(relative_path);
    if !trash_path.exists() {
        return Ok(());
    }

    let live_path = workspace_path.join(relative_path);
    if live_path.exists() {
        return Err(format!("path already exists: {relative_path}"));
    }

    if let Some(parent) = live_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::rename(&trash_path, &live_path).map_err(|error| error.to_string())
}

fn find_trashed_summary_by_id(
    workspace_path: &Path,
    id: &str,
) -> Result<TrashedPageSummary, String> {
    list_trashed_pages(workspace_path)?
        .into_iter()
        .find(|page| page.id == id)
        .ok_or_else(|| "page not found in trash".to_string())
}

fn walk_mdx_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    if dir.is_dir() {
        walk_mdx_files_rec(dir, &mut files)?;
    }
    Ok(files)
}

fn walk_mdx_files_rec(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            walk_mdx_files_rec(&path, files)?;
        } else if path.extension().and_then(|ext| ext.to_str()) == Some("mdx") {
            files.push(path);
        }
    }
    Ok(())
}

fn page_id_from_mdx(path: &Path) -> Result<String, String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let frontmatter = parse_frontmatter(&content);
    Ok(frontmatter
        .get("id")
        .cloned()
        .unwrap_or_else(|| file_stem_id(path)))
}

fn path_relative_to_workspace(workspace_path: &Path, file_path: &Path) -> String {
    file_path
        .strip_prefix(workspace_path)
        .unwrap_or(file_path)
        .to_string_lossy()
        .replace('\\', "/")
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

fn file_stem_id(path: &Path) -> String {
    path.file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or_default()
        .to_owned()
}

pub fn duplicate_page(
    workspace_path: &Path,
    cache: &mut CacheDb,
    id: &str,
) -> Result<PageDetail, String> {
    let source = get_page_or_err(cache, id)?;
    let parent_path = Path::new(&source.path)
        .parent()
        .map(|path| path.to_string_lossy().replace('\\', "/"))
        .unwrap_or_else(|| "pages".to_owned());

    let source_title = source.title.as_deref().unwrap_or("Untitled");
    let base_slug = source.slug.as_deref().unwrap_or(&source.id);

    create_page(
        workspace_path,
        cache,
        CreatePageInput {
            parent_path,
            title: Some(format!("Copy of {source_title}")),
            slug: Some(format!("{base_slug}-copy")),
            icon: source.icon,
            body: Some(source.body),
        },
    )
}

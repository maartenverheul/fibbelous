use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::time::SystemTime;

use chrono::Utc;
use indexmap::IndexMap;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

use crate::cache::{CacheDb, DatabaseDetail, DatabaseRowsPage, PageDetail, page_body_from_content};
use crate::index::sync_workspace;

/// On-disk shape of `databases/*/database.json`.
/// Field order here is the serialization order.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseFile {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edited: Option<String>,
    #[serde(default)]
    pub properties: IndexMap<String, DatabaseProperty>,
    #[serde(default)]
    pub views: Vec<DatabaseViewDef>,
}

/// A property column. Shared fields first, then `type` + type-specific config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseProperty {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(flatten)]
    pub config: DatabasePropertyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DatabasePropertyConfig {
    Title {
        title: EmptyObject,
    },
    RichText {
        rich_text: EmptyObject,
    },
    Number {
        number: NumberConfig,
    },
    Select {
        select: OptionsConfig,
    },
    MultiSelect {
        multi_select: OptionsConfig,
    },
    Status {
        status: StatusConfig,
    },
    Date {
        date: EmptyObject,
    },
    People {
        people: EmptyObject,
    },
    Files {
        files: EmptyObject,
    },
    Checkbox {
        checkbox: EmptyObject,
    },
    Url {
        url: EmptyObject,
    },
    Email {
        email: EmptyObject,
    },
    PhoneNumber {
        phone_number: EmptyObject,
    },
    Formula {
        formula: FormulaConfig,
    },
    Relation {
        relation: RelationConfig,
    },
    Rollup {
        rollup: EmptyObject,
    },
    CreatedTime {
        created_time: EmptyObject,
    },
    CreatedBy {
        created_by: EmptyObject,
    },
    LastEditedTime {
        last_edited_time: EmptyObject,
    },
    LastEditedBy {
        last_edited_by: EmptyObject,
    },
}

/// Empty `{}` config object used by many property types.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct EmptyObject {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NumberConfig {
    pub format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptionsConfig {
    #[serde(default)]
    pub options: Vec<SelectOption>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectOption {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusConfig {
    #[serde(default)]
    pub options: Vec<SelectOption>,
    #[serde(default)]
    pub groups: Vec<StatusGroup>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusGroup {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub option_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormulaConfig {
    pub expression: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationConfig {
    pub database_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data_source_id: Option<String>,
    #[serde(rename = "type")]
    pub relation_type: RelationType,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dual_property: Option<DualPropertyConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub single_property: Option<SinglePropertyConfig>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RelationType {
    DualProperty,
    SingleProperty,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DualPropertyConfig {
    pub synced_property_name: String,
    pub synced_property_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SinglePropertyConfig {
    pub synced_property_name: String,
    pub synced_property_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseViewDef {
    pub id: String,
    pub name: String,
    pub settings: DatabaseViewSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseViewSettings {
    pub layout: DatabaseViewLayout,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort: Option<DatabaseViewSort>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseViewSort {
    /// Property id from `database.json` properties.
    pub property: String,
    pub direction: DatabaseSortDirection,
}

/// Partial update for a database view. Omitted fields are left unchanged.
/// For nullable settings (e.g. `sort`), send `null` to clear.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseViewUpdate {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub layout: Option<DatabaseViewLayout>,
    #[serde(default, deserialize_with = "deserialize_present_option")]
    pub sort: Option<Option<DatabaseViewSort>>,
}

fn deserialize_present_option<'de, D, T>(
    deserializer: D,
) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::deserialize(deserializer)?))
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseSortDirection {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DatabaseViewLayout {
    Table,
    List,
}

impl DatabaseFile {
    pub fn default_table_view() -> DatabaseViewDef {
        DatabaseViewDef {
            id: "default".to_owned(),
            name: "All".to_owned(),
            settings: DatabaseViewSettings {
                layout: DatabaseViewLayout::Table,
                sort: None,
                filter: None,
            },
        }
    }

    pub fn default_list_view() -> DatabaseViewDef {
        DatabaseViewDef {
            id: "default-list".to_owned(),
            name: "List".to_owned(),
            settings: DatabaseViewSettings {
                layout: DatabaseViewLayout::List,
                sort: None,
                filter: None,
            },
        }
    }

    /// When `views` is empty, insert the default table and list views.
    /// Also adds the list view when only the stock default table view is present.
    /// Returns true when the file was modified.
    pub fn ensure_default_views(&mut self) -> bool {
        if self.views.is_empty() {
            self.views.push(Self::default_table_view());
            self.views.push(Self::default_list_view());
            return true;
        }

        let only_default_table = self.views.len() == 1
            && self.views[0].id == "default"
            && self.views[0].settings.layout == DatabaseViewLayout::Table;
        if only_default_table {
            self.views.push(Self::default_list_view());
            return true;
        }

        false
    }
}

pub fn get_database(
    workspace_path: &Path,
    cache: &CacheDb,
    id: &str,
) -> Result<Option<DatabaseDetail>, String> {
    let Some(meta) = cache
        .get_database_by_id(id)
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let file_path = workspace_path.join(&meta.path);
    let contents = fs::read_to_string(&file_path).map_err(|error| error.to_string())?;
    let mut database: DatabaseFile =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;

    if database.ensure_default_views() {
        write_database_json(&file_path, &database)?;
    }

    let json = serde_json::to_value(&database).map_err(|error| error.to_string())?;

    Ok(Some(DatabaseDetail {
        id: meta.id,
        slug: meta.slug,
        name: meta.name,
        path: meta.path,
        json,
    }))
}

fn write_database_json(path: &Path, database: &DatabaseFile) -> Result<(), String> {
    let mut serialized =
        serde_json::to_string_pretty(database).map_err(|error| error.to_string())?;
    serialized.push('\n');
    fs::write(path, serialized).map_err(|error| error.to_string())
}

pub fn list_database_rows(
    workspace_path: &Path,
    cache: &CacheDb,
    database_id: &str,
    limit: Option<usize>,
    offset: Option<usize>,
    sort: Option<DatabaseViewSort>,
) -> Result<Option<DatabaseRowsPage>, String> {
    let Some(meta) = cache
        .get_database_by_id(database_id)
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let (field, attribute_key) = if let Some(ref sort) = sort {
        let contents = fs::read_to_string(workspace_path.join(&meta.path))
            .map_err(|error| error.to_string())?;
        let database: DatabaseFile =
            serde_json::from_str(&contents).map_err(|error| error.to_string())?;
        resolve_sort_field(&database, sort)?
    } else {
        (DatabaseSortField::Edited, None)
    };

    let direction = sort
        .as_ref()
        .map(|s| s.direction)
        .or(Some(DatabaseSortDirection::Desc));

    let page = cache
        .list_database_rows(
            database_id,
            limit.unwrap_or(50),
            offset.unwrap_or(0),
            direction,
            field,
            attribute_key.as_deref(),
        )
        .map_err(|error| error.to_string())?;
    Ok(Some(page))
}

#[derive(Debug, Clone, Copy)]
pub enum DatabaseSortField {
    Edited,
    Title,
    Created,
    Attribute,
}

pub fn update_database_view(
    workspace_path: &Path,
    cache: &CacheDb,
    database_id: &str,
    view_id: &str,
    update: DatabaseViewUpdate,
) -> Result<Option<DatabaseDetail>, String> {
    mutate_database_view(workspace_path, cache, database_id, view_id, |view| {
        if let Some(name) = update.name {
            let name = name.trim().to_owned();
            if name.is_empty() {
                return Err("view name cannot be empty".to_owned());
            }
            view.name = name;
        }
        if let Some(layout) = update.layout {
            view.settings.layout = layout;
        }
        if let Some(sort) = update.sort {
            view.settings.sort = sort;
        }
        Ok(())
    })
}

fn mutate_database_view(
    workspace_path: &Path,
    cache: &CacheDb,
    database_id: &str,
    view_id: &str,
    mutate: impl FnOnce(&mut DatabaseViewDef) -> Result<(), String>,
) -> Result<Option<DatabaseDetail>, String> {
    let Some(meta) = cache
        .get_database_by_id(database_id)
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let file_path = workspace_path.join(&meta.path);
    let contents = fs::read_to_string(&file_path).map_err(|error| error.to_string())?;
    let mut database: DatabaseFile =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;

    database.ensure_default_views();

    let Some(view) = database.views.iter_mut().find(|view| view.id == view_id) else {
        return Err(format!("view not found: {view_id}"));
    };
    mutate(view)?;

    write_database_json(&file_path, &database)?;

    let json = serde_json::to_value(&database).map_err(|error| error.to_string())?;
    Ok(Some(DatabaseDetail {
        id: meta.id,
        slug: meta.slug,
        name: meta.name,
        path: meta.path,
        json,
    }))
}

/// Resolve which SQLite field to sort by for a property id in this database.
pub fn resolve_sort_field(
    database: &DatabaseFile,
    sort: &DatabaseViewSort,
) -> Result<(DatabaseSortField, Option<String>), String> {
    let property = database
        .properties
        .values()
        .find(|property| property.id == sort.property)
        .ok_or_else(|| format!("sort property not found: {}", sort.property))?;

    match &property.config {
        DatabasePropertyConfig::Title { .. } => Ok((DatabaseSortField::Title, None)),
        DatabasePropertyConfig::CreatedTime { .. } => Ok((DatabaseSortField::Created, None)),
        DatabasePropertyConfig::LastEditedTime { .. } => Ok((DatabaseSortField::Edited, None)),
        _ => {
            let key = property.name.to_lowercase();
            if !is_safe_attribute_key(&key) {
                return Err(format!("invalid sort property key: {key}"));
            }
            Ok((DatabaseSortField::Attribute, Some(key)))
        }
    }
}

fn is_safe_attribute_key(key: &str) -> bool {
    !key.is_empty()
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub fn create_database_row(
    workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
    title: Option<String>,
) -> Result<PageDetail, String> {
    let meta = cache
        .get_database_by_id(database_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "database not found".to_string())?;

    let database_dir = Path::new(&meta.path)
        .parent()
        .ok_or_else(|| "invalid database path".to_string())?;
    let database_dir_rel = database_dir
        .to_string_lossy()
        .replace('\\', "/");
    let database_dir_abs = workspace_path.join(database_dir);

    let title = title
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Untitled".to_owned());
    let slug = slugify(&title);
    let file_slug = if slug.is_empty() {
        "untitled".to_owned()
    } else {
        slug
    };
    let id = generate_row_id(&format!("{database_dir_rel}:{file_slug}"));
    let now = now_iso();

    let content = format!(
        "---\nid: {id}\nslug: {file_slug}\ntitle: {title}\ncreated: \"{now}\"\nedited: \"{now}\"\nattributes: {{}}\n---\n\n"
    );
    let file_path = database_dir_abs.join(format!("{id}-{file_slug}.mdx"));
    fs::create_dir_all(&database_dir_abs).map_err(|error| error.to_string())?;
    fs::write(&file_path, content).map_err(|error| error.to_string())?;

    sync_workspace(workspace_path, cache).map_err(|error| error.to_string())?;

    let relative_path = path_relative_to_workspace(workspace_path, &file_path);
    let content = fs::read_to_string(&file_path).map_err(|error| error.to_string())?;

    Ok(PageDetail {
        id,
        slug: Some(file_slug),
        title: Some(title),
        icon: None,
        path: relative_path,
        has_children: false,
        database_id: Some(database_id.to_owned()),
        body: page_body_from_content(&content),
    })
}

fn generate_row_id(salt: &str) -> String {
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

fn now_iso() -> String {
    Utc::now()
        .format("%Y-%m-%dT%H:%M:00.000Z")
        .to_string()
}

fn path_relative_to_workspace(workspace_path: &Path, path: &Path) -> String {
    path.strip_prefix(workspace_path)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/")
}

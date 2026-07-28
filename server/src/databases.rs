use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::time::SystemTime;

use chrono::Utc;
use indexmap::IndexMap;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

use crate::cache::{page_body_from_content, CacheDb, DatabaseDetail, DatabaseMeta, DatabaseRowsPage, PageDetail};
use crate::pages::{create_page, format_database_row_content, CreatePageInput, DatabaseRowFrontmatter};

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
    /// When true, the property is omitted from database views.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub disable: bool,
    #[serde(flatten)]
    pub config: DatabasePropertyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DatabasePropertyConfig {
    Title { title: EmptyObject },
    RichText { rich_text: EmptyObject },
    Number { number: NumberConfig },
    Select { select: OptionsConfig },
    MultiSelect { multi_select: OptionsConfig },
    Status { status: StatusConfig },
    Date { date: EmptyObject },
    People { people: EmptyObject },
    Files { files: EmptyObject },
    Checkbox { checkbox: EmptyObject },
    Url { url: EmptyObject },
    Email { email: EmptyObject },
    PhoneNumber { phone_number: EmptyObject },
    Formula { formula: FormulaConfig },
    Relation { relation: RelationConfig },
    Rollup { rollup: EmptyObject },
    CreatedTime { created_time: EmptyObject },
    CreatedBy { created_by: EmptyObject },
    LastEditedTime { last_edited_time: EmptyObject },
    LastEditedBy { last_edited_by: EmptyObject },
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

fn deserialize_present_option<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
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
    _workspace_path: &Path,
    cache: &mut CacheDb,
    id: &str,
) -> Result<Option<(DatabaseDetail, bool)>, String> {
    let Some(meta) = cache
        .get_database_by_id(id)
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let contents = cache
        .get_database_content(id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "database content not found".to_owned())?;
    let mut database: DatabaseFile =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;

    let mutated = database.ensure_default_views();
    if mutated {
        let mut serialized =
            serde_json::to_string_pretty(&database).map_err(|error| error.to_string())?;
        serialized.push('\n');
        cache
            .upsert_database_content(id, &serialized)
            .map_err(|error| error.to_string())?;
    }

    let json = serde_json::to_value(&database).map_err(|error| error.to_string())?;

    Ok(Some((
        DatabaseDetail {
            id: meta.id,
            slug: meta.slug,
            name: meta.name,
            path: meta.path,
            json,
        },
        mutated,
    )))
}

pub fn list_database_rows(
    _workspace_path: &Path,
    cache: &CacheDb,
    database_id: &str,
    limit: Option<usize>,
    offset: Option<usize>,
    sort: Option<DatabaseViewSort>,
) -> Result<Option<DatabaseRowsPage>, String> {
    let Some(_meta) = cache
        .get_database_by_id(database_id)
        .map_err(|error| error.to_string())?
    else {
        return Ok(None);
    };

    let resolved = if let Some(ref sort) = sort {
        let contents = cache
            .get_database_content(database_id)
            .map_err(|error| error.to_string())?
            .ok_or_else(|| "database content not found".to_owned())?;
        let database: DatabaseFile =
            serde_json::from_str(&contents).map_err(|error| error.to_string())?;
        resolve_sort(&database, sort)?
    } else {
        ResolvedDatabaseSort::Edited
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
            &resolved,
        )
        .map_err(|error| error.to_string())?;
    Ok(Some(page))
}

#[derive(Debug, Clone)]
pub enum ResolvedDatabaseSort {
    Edited,
    Title,
    Created,
    /// Full SQL expression for `ORDER BY <expr> ASC|DESC` (no direction suffix).
    AttributeExpr(String),
}

pub fn update_database_view(
    _workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
    view_id: &str,
    update: DatabaseViewUpdate,
) -> Result<Option<DatabaseDetail>, String> {
    mutate_database_view(cache, database_id, view_id, |view| {
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
    cache: &mut CacheDb,
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

    let contents = cache
        .get_database_content(database_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "database content not found".to_owned())?;
    let mut database: DatabaseFile =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;

    database.ensure_default_views();

    let Some(view) = database.views.iter_mut().find(|view| view.id == view_id) else {
        return Err(format!("view not found: {view_id}"));
    };
    mutate(view)?;

    let mut serialized =
        serde_json::to_string_pretty(&database).map_err(|error| error.to_string())?;
    serialized.push('\n');
    cache
        .upsert_database_content(database_id, &serialized)
        .map_err(|error| error.to_string())?;

    let json = serde_json::to_value(&database).map_err(|error| error.to_string())?;
    Ok(Some(DatabaseDetail {
        id: meta.id,
        slug: meta.slug,
        name: meta.name,
        path: meta.path,
        json,
    }))
}

/// Resolve which SQLite field / expression to sort by for a property id.
pub fn resolve_sort(
    database: &DatabaseFile,
    sort: &DatabaseViewSort,
) -> Result<ResolvedDatabaseSort, String> {
    let (map_key, property) = database
        .properties
        .iter()
        .find(|(_, property)| property.id == sort.property)
        .map(|(key, property)| (key.as_str(), property))
        .ok_or_else(|| format!("sort property not found: {}", sort.property))?;

    match &property.config {
        DatabasePropertyConfig::Title { .. } => Ok(ResolvedDatabaseSort::Title),
        DatabasePropertyConfig::CreatedTime { .. } => Ok(ResolvedDatabaseSort::Created),
        DatabasePropertyConfig::LastEditedTime { .. } => Ok(ResolvedDatabaseSort::Edited),
        DatabasePropertyConfig::Number { .. } => Ok(ResolvedDatabaseSort::AttributeExpr(
            attribute_sort_expression(
                &[property.id.as_str(), map_key, property.name.as_str()],
                true,
            ),
        )),
        _ => Ok(ResolvedDatabaseSort::AttributeExpr(
            attribute_sort_expression(
                &[property.id.as_str(), map_key, property.name.as_str()],
                false,
            ),
        )),
    }
}

/// Build a SQL expression that reads an attribute from `attributes_json`.
/// Tries `property.id`, then the `database.json` map key, then `property.name`.
fn attribute_sort_expression(keys: &[&str], numeric: bool) -> String {
    let mut unique = Vec::new();
    for key in keys {
        if key.is_empty() {
            continue;
        }
        if !unique.iter().any(|existing| existing == key) {
            unique.push(*key);
        }
    }

    let extract = match unique.as_slice() {
        [] => "NULL".to_owned(),
        [key] => format!(
            "json_extract(attributes_json, {})",
            json_path_sql_literal(key)
        ),
        keys => {
            let parts: Vec<String> = keys
                .iter()
                .map(|key| {
                    format!(
                        "json_extract(attributes_json, {})",
                        json_path_sql_literal(key)
                    )
                })
                .collect();
            format!("COALESCE({})", parts.join(", "))
        }
    };

    if numeric {
        format!("CAST(({extract}) AS REAL)")
    } else {
        format!("CAST(({extract}) AS TEXT) COLLATE NOCASE")
    }
}

/// JSON path for `json_extract`, as a SQL string literal: `'$."Key"'`.
fn json_path_sql_literal(key: &str) -> String {
    let mut path = String::from("$.\"");
    for ch in key.chars() {
        match ch {
            '\\' => path.push_str("\\\\"),
            '"' => path.push_str("\\\""),
            _ => path.push(ch),
        }
    }
    path.push('"');
    format!("'{}'", path.replace('\'', "''"))
}

#[cfg(test)]
mod sort_tests {
    use super::{attribute_sort_expression, json_path_sql_literal};

    #[test]
    fn json_path_quotes_keys_with_spaces() {
        assert_eq!(json_path_sql_literal("Story Points"), "'$.\"Story Points\"'");
    }

    #[test]
    fn json_path_escapes_quotes_and_sql() {
        assert_eq!(json_path_sql_literal(r#"a"b"#), r#"'$."a\"b"'"#);
        assert_eq!(json_path_sql_literal("O'Brien"), r#"'$."O''Brien"'"#);
    }

    #[test]
    fn attribute_expression_coalesces_name_and_map_key() {
        let expr = attribute_sort_expression(&["Status", "AbCd"], false);
        assert!(expr.contains("COALESCE("));
        assert!(expr.contains("$.\"Status\""));
        assert!(expr.contains("$.\"AbCd\""));
        assert!(expr.contains("COLLATE NOCASE"));
    }

    #[test]
    fn number_expression_casts_to_real() {
        let expr = attribute_sort_expression(&["Count"], true);
        assert!(expr.starts_with("CAST("));
        assert!(expr.contains("AS REAL"));
        assert!(!expr.contains("COLLATE"));
    }
}

pub fn create_database_row(
    _workspace_path: &Path,
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
    let database_dir_rel = database_dir.to_string_lossy().replace('\\', "/");

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

    let content = format_database_row_content(
        &DatabaseRowFrontmatter {
            id: id.clone(),
            slug: file_slug.clone(),
            title: title.clone(),
            icon: None,
            favorite: false,
            created: now.clone(),
            edited: now.clone(),
            properties_block: "properties: {}\n".to_owned(),
        },
        "",
    );
    let relative_path = format!("{database_dir_rel}/{id}-{file_slug}.mdx");
    cache
        .upsert_database_row_mutable(
            &relative_path,
            database_id,
            &id,
            Some(&file_slug),
            Some(&title),
            None,
            &content,
            false,
        )
        .map_err(|error| error.to_string())?;
    let body = page_body_from_content(&content);

    let referenced_pages = cache
        .referenced_pages_for_body(&body)
        .map_err(|error| error.to_string())?;

    Ok(PageDetail {
        id,
        parent_id: None,
        slug: Some(file_slug),
        title: Some(title),
        icon: None,
        path: relative_path,
        has_children: false,
        favorite: false,
        database_id: Some(database_id.to_owned()),
        attributes: Some(serde_json::json!({})),
        created: Some(now.clone()),
        edited: Some(now),
        body_hash: crate::cache::hash_body(&body),
        body,
        referenced_pages,
        ancestors: Vec::new(),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDatabaseResult {
    pub database: DatabaseDetail,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<PageDetail>,
}

/// List all indexed databases (id, slug, name, path).
pub fn list_databases(cache: &CacheDb) -> Result<Vec<DatabaseMeta>, String> {
    cache
        .list_databases()
        .map_err(|error| error.to_string())
}

/// Create a new `databases/{id}/database.json`. When `parent_id` is set, also
/// creates a host page with the same id and a database-only body.
pub fn create_database(
    workspace_path: &Path,
    cache: &mut CacheDb,
    title: Option<String>,
    parent_id: Option<String>,
) -> Result<CreateDatabaseResult, String> {
    let title = title
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "Untitled".to_owned());
    let slug = slugify(&title);
    let file_slug = if slug.is_empty() {
        "untitled".to_owned()
    } else {
        slug
    };
    let id = generate_row_id(&format!("database:{file_slug}:{parent_id:?}"));

    if cache
        .get_database_by_id(&id)
        .map_err(|error| error.to_string())?
        .is_some()
    {
        return Err("database id collision".to_owned());
    }

    let now = now_iso();
    let mut properties = IndexMap::new();
    properties.insert(
        "title".to_owned(),
        DatabaseProperty {
            id: "title".to_owned(),
            name: "Name".to_owned(),
            description: None,
            disable: false,
            config: DatabasePropertyConfig::Title {
                title: EmptyObject {},
            },
        },
    );

    let mut database = DatabaseFile {
        id: id.clone(),
        slug: Some(file_slug.clone()),
        title: Some(title.clone()),
        name: Some(title.clone()),
        created: Some(now.clone()),
        edited: Some(now),
        properties,
        views: Vec::new(),
    };
    database.ensure_default_views();

    let mut serialized =
        serde_json::to_string_pretty(&database).map_err(|error| error.to_string())?;
    serialized.push('\n');

    let relative_path = format!("databases/{id}/database.json");
    cache
        .upsert_database_mutable(
            &relative_path,
            &id,
            Some(&file_slug),
            Some(&title),
            &serialized,
        )
        .map_err(|error| error.to_string())?;

    let json = serde_json::to_value(&database).map_err(|error| error.to_string())?;
    let database_detail = DatabaseDetail {
        id: id.clone(),
        slug: Some(file_slug),
        name: Some(title.clone()),
        path: relative_path,
        json,
    };

    let page = if let Some(parent_id) = parent_id {
        let body = format!("<Database id=\"{id}\" />");
        let page = create_page(
            workspace_path,
            cache,
            CreatePageInput {
                id: Some(id.clone()),
                parent_id: Some(parent_id),
                title: Some(title),
                slug: None,
                icon: None,
                body: Some(body),
                favorite: false,
            },
        )?;
        Some(page)
    } else {
        None
    };

    Ok(CreateDatabaseResult {
        database: database_detail,
        page,
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
    Utc::now().format("%Y-%m-%dT%H:%M:00.000Z").to_string()
}

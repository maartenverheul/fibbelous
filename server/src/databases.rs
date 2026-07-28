use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::time::SystemTime;

use chrono::Utc;
use indexmap::IndexMap;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;

use crate::cache::{page_body_from_content, CacheDb, DatabaseDetail, DatabaseMeta, DatabaseRowsPage, PageDetail};
use crate::pages::{
    create_page, format_database_row_content, format_properties_block, CreatePageInput,
    DatabaseRowFrontmatter,
};

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
    /// Custom row templates (Empty is virtual and never stored here).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub templates: Vec<DatabaseRowTemplate>,
    /// Id of the default template used by New. Absent/`"empty"` => Empty.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "defaultTemplateId"
    )]
    pub default_template_id: Option<String>,
}

/// Built-in locked Empty template id (never persisted in `templates`).
pub const EMPTY_TEMPLATE_ID: &str = "empty";

/// A named row template that presets property values and body content.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseRowTemplate {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub body: String,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub properties: IndexMap<String, Value>,
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
    pub layout: DatabaseViewLayout,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort: Option<DatabaseViewSort>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter: Option<Value>,
    /// Ordered property visibility for this view. Absent = all non-disabled schema props.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub properties: Option<Vec<DatabaseViewProperty>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseViewProperty {
    pub id: String,
    pub visible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseViewSort {
    /// Property id from `database.json` properties.
    pub property: String,
    pub direction: DatabaseSortDirection,
}

/// Partial update for a database view. Omitted fields are left unchanged.
/// For nullable fields (e.g. `sort`), send `null` to clear.
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseViewUpdate {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub layout: Option<DatabaseViewLayout>,
    #[serde(default, deserialize_with = "deserialize_present_option")]
    pub sort: Option<Option<DatabaseViewSort>>,
    #[serde(default)]
    pub properties: Option<Vec<DatabaseViewProperty>>,
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
    pub fn default_created_property() -> DatabaseProperty {
        DatabaseProperty {
            id: "created".to_owned(),
            name: "Created".to_owned(),
            description: None,
            disable: false,
            config: DatabasePropertyConfig::CreatedTime {
                created_time: EmptyObject {},
            },
        }
    }

    pub fn default_edited_property() -> DatabaseProperty {
        DatabaseProperty {
            id: "edited".to_owned(),
            name: "Edited".to_owned(),
            description: None,
            disable: false,
            config: DatabasePropertyConfig::LastEditedTime {
                last_edited_time: EmptyObject {},
            },
        }
    }

    /// Default view property visibility: created/edited hidden, others shown.
    pub fn default_view_properties(
        properties: &IndexMap<String, DatabaseProperty>,
    ) -> Option<Vec<DatabaseViewProperty>> {
        if properties.is_empty() {
            return None;
        }

        let mut entries = Vec::with_capacity(properties.len());
        for property in properties.values() {
            let visible = !matches!(
                property.config,
                DatabasePropertyConfig::CreatedTime { .. }
                    | DatabasePropertyConfig::LastEditedTime { .. }
            );
            entries.push(DatabaseViewProperty {
                id: property.id.clone(),
                visible,
            });
        }
        Some(entries)
    }

    pub fn default_table_view(
        properties: &IndexMap<String, DatabaseProperty>,
    ) -> DatabaseViewDef {
        DatabaseViewDef {
            id: "default".to_owned(),
            name: "All".to_owned(),
            layout: DatabaseViewLayout::Table,
            sort: None,
            filter: None,
            properties: Self::default_view_properties(properties),
        }
    }

    pub fn default_list_view(
        properties: &IndexMap<String, DatabaseProperty>,
    ) -> DatabaseViewDef {
        DatabaseViewDef {
            id: "default-list".to_owned(),
            name: "List".to_owned(),
            layout: DatabaseViewLayout::List,
            sort: None,
            filter: None,
            properties: Self::default_view_properties(properties),
        }
    }

    /// When `views` is empty, insert the default table and list views.
    /// Also adds the list view when only the stock default table view is present.
    /// Returns true when the file was modified.
    pub fn ensure_default_views(&mut self) -> bool {
        if self.views.is_empty() {
            self.views
                .push(Self::default_table_view(&self.properties));
            self.views
                .push(Self::default_list_view(&self.properties));
            return true;
        }

        let only_default_table = self.views.len() == 1
            && self.views[0].id == "default"
            && self.views[0].layout == DatabaseViewLayout::Table;
        if only_default_table {
            self.views
                .push(Self::default_list_view(&self.properties));
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
            view.layout = layout;
        }
        if let Some(sort) = update.sort {
            view.sort = sort;
        }
        if let Some(properties) = update.properties {
            view.properties = if properties.is_empty() {
                None
            } else {
                Some(properties)
            };
        }
        Ok(())
    })
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CreateDatabaseViewInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub layout: Option<DatabaseViewLayout>,
    /// When set, copy layout/sort/filter/properties from this view (layout/name still overridable).
    #[serde(default)]
    pub copy_from_view_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDatabaseViewResult {
    pub database: DatabaseDetail,
    pub view_id: String,
}

pub fn create_database_view(
    _workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
    input: CreateDatabaseViewInput,
) -> Result<Option<CreateDatabaseViewResult>, String> {
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

    let template = input
        .copy_from_view_id
        .as_deref()
        .and_then(|id| database.views.iter().find(|view| view.id == id))
        .cloned();

    let layout = input
        .layout
        .or_else(|| template.as_ref().map(|view| view.layout))
        .unwrap_or(DatabaseViewLayout::Table);

    let name = input
        .name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| unique_view_name(&database.views, "Untitled"));

    let view_id = unique_view_id(&database.views, database_id);
    let view = DatabaseViewDef {
        id: view_id.clone(),
        name,
        layout,
        sort: template.as_ref().and_then(|view| view.sort.clone()),
        filter: template.as_ref().and_then(|view| view.filter.clone()),
        properties: template
            .as_ref()
            .and_then(|view| view.properties.clone())
            .or_else(|| DatabaseFile::default_view_properties(&database.properties)),
    };
    database.views.push(view);

    let detail = save_database_file(cache, &meta, database_id, &database)?;
    Ok(Some(CreateDatabaseViewResult {
        database: detail,
        view_id,
    }))
}

pub fn delete_database_view(
    _workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
    view_id: &str,
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

    if database.views.len() <= 1 {
        return Err("cannot delete the last view".to_owned());
    }
    let before = database.views.len();
    database.views.retain(|view| view.id != view_id);
    if database.views.len() == before {
        return Err(format!("view not found: {view_id}"));
    }

    let detail = save_database_file(cache, &meta, database_id, &database)?;
    Ok(Some(detail))
}

fn unique_view_id(views: &[DatabaseViewDef], database_id: &str) -> String {
    for _ in 0..8 {
        let candidate = format!("view-{}", generate_row_id(database_id));
        if !views.iter().any(|view| view.id == candidate) {
            return candidate;
        }
    }
    format!("view-{}", generate_row_id(&format!("{database_id}:retry")))
}

fn unique_view_name(views: &[DatabaseViewDef], base: &str) -> String {
    if !views.iter().any(|view| view.name == base) {
        return base.to_owned();
    }
    for index in 2..1000 {
        let candidate = format!("{base} {index}");
        if !views.iter().any(|view| view.name == candidate) {
            return candidate;
        }
    }
    format!("{base} {}", generate_row_id(base))
}

fn save_database_file(
    cache: &mut CacheDb,
    meta: &crate::cache::DatabaseMeta,
    database_id: &str,
    database: &DatabaseFile,
) -> Result<DatabaseDetail, String> {
    let mut serialized =
        serde_json::to_string_pretty(database).map_err(|error| error.to_string())?;
    serialized.push('\n');
    cache
        .upsert_database_content(database_id, &serialized)
        .map_err(|error| error.to_string())?;

    let json = serde_json::to_value(database).map_err(|error| error.to_string())?;
    Ok(DatabaseDetail {
        id: meta.id.clone(),
        slug: meta.slug.clone(),
        name: meta.name.clone(),
        path: meta.path.clone(),
        json,
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

    let detail = save_database_file(cache, &meta, database_id, &database)?;
    Ok(Some(detail))
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
    template_id: Option<String>,
) -> Result<PageDetail, String> {
    let meta = cache
        .get_database_by_id(database_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "database not found".to_string())?;

    let contents = cache
        .get_database_content(database_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "database content not found".to_owned())?;
    let database: DatabaseFile =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;

    let resolved_template_id = resolve_template_id(&database, template_id.as_deref())?;
    let template = resolved_row_template(&database, &resolved_template_id)?;

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

    let properties_value = Value::Object(template.properties.iter().map(|(k, v)| (k.clone(), v.clone())).collect());
    let properties_block = format_properties_block(&properties_value)?;
    let icon = template.icon.clone().filter(|value| !value.is_empty());
    let body = template.body.clone();

    let content = format_database_row_content(
        &DatabaseRowFrontmatter {
            id: id.clone(),
            slug: file_slug.clone(),
            title: title.clone(),
            icon: icon.clone(),
            favorite: false,
            created: now.clone(),
            edited: now.clone(),
            properties_block,
        },
        &body,
    );
    let relative_path = format!("{database_dir_rel}/{id}-{file_slug}.mdx");
    cache
        .upsert_database_row_mutable(
            &relative_path,
            database_id,
            &id,
            Some(&file_slug),
            Some(&title),
            icon.as_deref(),
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
        icon,
        path: relative_path,
        has_children: false,
        favorite: false,
        database_id: Some(database_id.to_owned()),
        is_database_template: false,
        attributes: Some(properties_value),
        created: Some(now.clone()),
        edited: Some(now),
        body_hash: crate::cache::hash_body(&body),
        body,
        referenced_pages,
        ancestors: Vec::new(),
    })
}

/// Effective default template id for a database (`empty` when unset/invalid).
pub fn effective_default_template_id(database: &DatabaseFile) -> String {
    match database.default_template_id.as_deref() {
        None | Some("") | Some(EMPTY_TEMPLATE_ID) => EMPTY_TEMPLATE_ID.to_owned(),
        Some(id) if database.templates.iter().any(|template| template.id == id) => {
            id.to_owned()
        }
        Some(_) => EMPTY_TEMPLATE_ID.to_owned(),
    }
}

fn resolve_template_id(
    database: &DatabaseFile,
    requested: Option<&str>,
) -> Result<String, String> {
    match requested {
        None | Some("") => Ok(effective_default_template_id(database)),
        Some(EMPTY_TEMPLATE_ID) => Ok(EMPTY_TEMPLATE_ID.to_owned()),
        Some(id) => {
            if database.templates.iter().any(|template| template.id == id) {
                Ok(id.to_owned())
            } else {
                Err(format!("template not found: {id}"))
            }
        }
    }
}

fn empty_row_template() -> DatabaseRowTemplate {
    DatabaseRowTemplate {
        id: EMPTY_TEMPLATE_ID.to_owned(),
        name: "Empty".to_owned(),
        icon: None,
        body: String::new(),
        properties: IndexMap::new(),
    }
}

fn resolved_row_template(
    database: &DatabaseFile,
    template_id: &str,
) -> Result<DatabaseRowTemplate, String> {
    if template_id == EMPTY_TEMPLATE_ID {
        return Ok(empty_row_template());
    }
    database
        .templates
        .iter()
        .find(|template| template.id == template_id)
        .cloned()
        .ok_or_else(|| format!("template not found: {template_id}"))
}

fn template_path(database_id: &str, template_id: &str) -> String {
    format!("databases/{database_id}/templates/{template_id}")
}

fn template_to_page_detail(
    cache: &CacheDb,
    database_id: &str,
    template: &DatabaseRowTemplate,
) -> Result<PageDetail, String> {
    if template.id == EMPTY_TEMPLATE_ID {
        return Err("cannot open the Empty template for editing".to_owned());
    }
    let attributes = Value::Object(
        template
            .properties
            .iter()
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect(),
    );
    let body = template.body.clone();
    let referenced_pages = cache
        .referenced_pages_for_body(&body)
        .map_err(|error| error.to_string())?;
    let slug = {
        let derived = slugify(&template.name);
        if derived.is_empty() {
            "untitled".to_owned()
        } else {
            derived
        }
    };
    Ok(PageDetail {
        id: template.id.clone(),
        parent_id: None,
        slug: Some(slug),
        title: Some(template.name.clone()),
        icon: template.icon.clone(),
        path: template_path(database_id, &template.id),
        has_children: false,
        favorite: false,
        database_id: Some(database_id.to_owned()),
        is_database_template: true,
        attributes: Some(attributes),
        created: None,
        edited: None,
        body_hash: crate::cache::hash_body(&body),
        body,
        referenced_pages,
        ancestors: Vec::new(),
    })
}

fn unique_template_id(templates: &[DatabaseRowTemplate], database_id: &str) -> String {
    for _ in 0..8 {
        let candidate = generate_row_id(database_id);
        if candidate != EMPTY_TEMPLATE_ID
            && !templates.iter().any(|template| template.id == candidate)
        {
            return candidate;
        }
    }
    let fallback = generate_row_id(&format!("{database_id}:template-retry"));
    format!("tpl-{fallback}")
}

fn unique_template_name(templates: &[DatabaseRowTemplate], base: &str) -> String {
    if !templates.iter().any(|template| template.name == base) {
        return base.to_owned();
    }
    for index in 2..1000 {
        let candidate = format!("{base} {index}");
        if !templates.iter().any(|template| template.name == candidate) {
            return candidate;
        }
    }
    format!("{base} {}", generate_row_id(base))
}

fn load_database_file(
    cache: &CacheDb,
    database_id: &str,
) -> Result<(DatabaseMeta, DatabaseFile), String> {
    let meta = cache
        .get_database_by_id(database_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "database not found".to_string())?;
    let contents = cache
        .get_database_content(database_id)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "database content not found".to_owned())?;
    let database: DatabaseFile =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;
    Ok((meta, database))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDatabaseTemplateResult {
    pub database: DatabaseDetail,
    pub page: PageDetail,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDatabaseTemplateInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub attributes: Option<Value>,
}

pub fn create_database_template(
    _workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
) -> Result<Option<CreateDatabaseTemplateResult>, String> {
    let Ok((meta, mut database)) = load_database_file(cache, database_id) else {
        return Ok(None);
    };

    let id = unique_template_id(&database.templates, database_id);
    let name = unique_template_name(&database.templates, "New template");
    let template = DatabaseRowTemplate {
        id: id.clone(),
        name,
        icon: None,
        body: String::new(),
        properties: IndexMap::new(),
    };
    let page = template_to_page_detail(cache, database_id, &template)?;
    database.templates.push(template);
    let detail = save_database_file(cache, &meta, database_id, &database)?;
    Ok(Some(CreateDatabaseTemplateResult {
        database: detail,
        page,
    }))
}

pub fn get_database_template(
    _workspace_path: &Path,
    cache: &CacheDb,
    database_id: &str,
    template_id: &str,
) -> Result<Option<PageDetail>, String> {
    let Ok((_, database)) = load_database_file(cache, database_id) else {
        return Ok(None);
    };
    if template_id == EMPTY_TEMPLATE_ID {
        return Err("cannot open the Empty template for editing".to_owned());
    }
    let Some(template) = database
        .templates
        .iter()
        .find(|template| template.id == template_id)
    else {
        return Ok(None);
    };
    Ok(Some(template_to_page_detail(cache, database_id, template)?))
}

/// Find a template by id across all databases (for page navigation / deep links).
pub fn find_database_template(
    cache: &CacheDb,
    template_id: &str,
) -> Result<Option<PageDetail>, String> {
    if template_id == EMPTY_TEMPLATE_ID {
        return Err("cannot open the Empty template for editing".to_owned());
    }
    let databases = cache
        .list_databases()
        .map_err(|error| error.to_string())?;
    for meta in databases {
        let contents = match cache.get_database_content(&meta.id) {
            Ok(Some(contents)) => contents,
            Ok(None) => continue,
            Err(error) => return Err(error.to_string()),
        };
        let database: DatabaseFile =
            serde_json::from_str(&contents).map_err(|error| error.to_string())?;
        if let Some(template) = database
            .templates
            .iter()
            .find(|template| template.id == template_id)
        {
            return Ok(Some(template_to_page_detail(cache, &meta.id, template)?));
        }
    }
    Ok(None)
}

pub fn update_database_template(
    _workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
    template_id: &str,
    update: UpdateDatabaseTemplateInput,
) -> Result<Option<PageDetail>, String> {
    if template_id == EMPTY_TEMPLATE_ID {
        return Err("cannot edit the Empty template".to_owned());
    }
    let Ok((meta, mut database)) = load_database_file(cache, database_id) else {
        return Ok(None);
    };
    let Some(template) = database
        .templates
        .iter_mut()
        .find(|template| template.id == template_id)
    else {
        return Ok(None);
    };

    if let Some(title) = update.title {
        template.name = title.trim().to_owned();
    }
    if let Some(icon) = update.icon {
        template.icon = if icon.trim().is_empty() {
            None
        } else {
            Some(icon)
        };
    }
    if let Some(body) = update.body {
        template.body = body;
    }
    if let Some(attributes) = update.attributes {
        let map = match attributes {
            Value::Null => IndexMap::new(),
            Value::Object(object) => object.into_iter().collect(),
            _ => return Err("attributes must be a JSON object".to_owned()),
        };
        template.properties = map;
    }

    let page = template_to_page_detail(cache, database_id, template)?;
    save_database_file(cache, &meta, database_id, &database)?;
    Ok(Some(page))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateDatabaseTemplateResult {
    pub database: DatabaseDetail,
    pub page: PageDetail,
}

pub fn duplicate_database_template(
    _workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
    template_id: &str,
) -> Result<Option<DuplicateDatabaseTemplateResult>, String> {
    let Ok((meta, mut database)) = load_database_file(cache, database_id) else {
        return Ok(None);
    };
    let source = resolved_row_template(&database, template_id)?;
    let id = unique_template_id(&database.templates, database_id);
    let source_label = if source.name.trim().is_empty() {
        "Untitled"
    } else {
        source.name.as_str()
    };
    let name = unique_template_name(
        &database.templates,
        &format!("Copy of {source_label}"),
    );
    let template = DatabaseRowTemplate {
        id: id.clone(),
        name,
        icon: source.icon,
        body: source.body,
        properties: source.properties,
    };
    let page = template_to_page_detail(cache, database_id, &template)?;
    database.templates.push(template);
    let detail = save_database_file(cache, &meta, database_id, &database)?;
    Ok(Some(DuplicateDatabaseTemplateResult {
        database: detail,
        page,
    }))
}

pub fn delete_database_template(
    _workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
    template_id: &str,
) -> Result<Option<DatabaseDetail>, String> {
    if template_id == EMPTY_TEMPLATE_ID {
        return Err("cannot delete the Empty template".to_owned());
    }
    let Ok((meta, mut database)) = load_database_file(cache, database_id) else {
        return Ok(None);
    };
    let before = database.templates.len();
    database.templates.retain(|template| template.id != template_id);
    if database.templates.len() == before {
        return Err(format!("template not found: {template_id}"));
    }
    if database.default_template_id.as_deref() == Some(template_id) {
        database.default_template_id = None;
    }
    let detail = save_database_file(cache, &meta, database_id, &database)?;
    Ok(Some(detail))
}

pub fn set_default_database_template(
    _workspace_path: &Path,
    cache: &mut CacheDb,
    database_id: &str,
    template_id: &str,
) -> Result<Option<DatabaseDetail>, String> {
    let Ok((meta, mut database)) = load_database_file(cache, database_id) else {
        return Ok(None);
    };
    if template_id == EMPTY_TEMPLATE_ID {
        database.default_template_id = None;
    } else if database.templates.iter().any(|template| template.id == template_id) {
        database.default_template_id = Some(template_id.to_owned());
    } else {
        return Err(format!("template not found: {template_id}"));
    }
    let detail = save_database_file(cache, &meta, database_id, &database)?;
    Ok(Some(detail))
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
    properties.insert(
        "created".to_owned(),
        DatabaseFile::default_created_property(),
    );
    properties.insert(
        "edited".to_owned(),
        DatabaseFile::default_edited_property(),
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
        templates: Vec::new(),
        default_template_id: None,
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

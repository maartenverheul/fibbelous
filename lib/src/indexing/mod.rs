use std::path::Path;

use crate::migration::Migrator;
use chrono::{DateTime, SecondsFormat, Utc};
use sea_orm::entity::prelude::*;
use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr};
use sea_orm_migration::MigratorTrait;
use tracing::log::LevelFilter;
use tracing::{debug, error, info};

/// Name of the app database file within a workspace directory
pub const DB_FILE: &str = "index.sqlite";

/// Open (and create if missing) the workspace SQLite database
/// Ensures the base schema exists. Returns an async SeaORM DatabaseConnection.
pub async fn init_index_db(location: &Path) -> Result<DatabaseConnection, DbErr> {
    let db_path = location.join(DB_FILE);
    info!("Initializing index database at {:?}", db_path);
    if let Some(parent) = db_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            error!("Failed to create parent directory {:?}: {}", parent, e);
            return Err(DbErr::Conn(sea_orm::RuntimeErr::Internal(e.to_string())));
        }
    }

    // Build a SQLite URL similar to the working hardcoded example
    let mut path_str = db_path.to_string_lossy().to_string();
    if std::path::MAIN_SEPARATOR == '\\' {
        path_str = path_str.replace('\\', "/");
    }
    let url = if db_path.is_absolute() {
        let is_windows_drive = path_str.chars().nth(1) == Some(':');
        if is_windows_drive {
            // e.g. sqlite://C:/path/to/index.sqlite
            format!("sqlite://{}?mode=rwc", path_str)
        } else {
            // e.g. sqlite:///var/data/index.sqlite
            format!("sqlite:///{}?mode=rwc", path_str)
        }
    } else {
        // relative path (use sqlite:prefix)
        format!("sqlite:{}?mode=rwc", path_str)
    };

    let mut opt = ConnectOptions::new(&url);
    opt.sqlx_logging_level(LevelFilter::Debug); // Or set SQLx log level

    let db = Database::connect(opt).await?;
    debug!("Opened SeaORM SQLite connection");
    Migrator::up(&db, None).await?;
    info!("Database migrated");
    Ok(db)
}

// Repository-style helpers working with the domain Page type
pub async fn create_page(
    db: &DatabaseConnection,
    page: crate::pages::Page,
) -> Result<crate::pages::Page, DbErr> {
    let am: pages::ActiveModel = page.into();
    let model = am.insert(db).await?;
    Ok(model.into())
}

pub async fn get_page(
    db: &DatabaseConnection,
    id: &str,
) -> Result<Option<crate::pages::Page>, DbErr> {
    Ok(pages::Entity::find_by_id(id.to_string())
        .one(db)
        .await?
        .map(|m| m.into()))
}

pub async fn update_page(
    db: &DatabaseConnection,
    page: crate::pages::Page,
) -> Result<crate::pages::Page, DbErr> {
    use sea_orm::EntityTrait;
    // Ensure it exists; if not, return not found
    let exists = pages::Entity::find_by_id(page.id.clone()).one(db).await?;
    if exists.is_none() {
        return Err(DbErr::RecordNotFound(format!("page {} not found", page.id)));
    }
    let am: pages::ActiveModel = page.into();
    let model = am.update(db).await?;
    Ok(model.into())
}

pub async fn delete_page(db: &DatabaseConnection, id: &str) -> Result<(), DbErr> {
    use sea_orm::EntityTrait;
    let res = pages::Entity::delete_by_id(id.to_string()).exec(db).await?;
    if res.rows_affected == 0 {
        Err(DbErr::RecordNotFound(format!("page {} not found", id)))
    } else {
        Ok(())
    }
}

pub async fn list_children(
    db: &DatabaseConnection,
    parent_id: Option<&str>,
) -> Result<Vec<crate::pages::Page>, DbErr> {
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
    let mut query = pages::Entity::find();
    query = match parent_id {
        Some(pid) => query.filter(pages::Column::ParentId.eq(pid.to_string())),
        None => query.filter(pages::Column::ParentId.is_null()),
    };
    let rows = query.all(db).await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

// Entity: pages (schema controlled via migrations)
mod pages {
    use super::*;
    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "pages")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: String,
        pub parent_id: Option<String>,
        pub title: String,
        pub cover: Option<String>,
        pub icon: Option<String>,
        // Stored as RFC3339 seconds precision strings in DB
        pub created_at: String,
        pub updated_at: Option<String>,
        pub deleted_at: Option<String>,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

// Note: schema_migrations table is managed by sea-orm-migration internally

// Mappers between ORM entity and domain model
impl From<pages::Model> for crate::pages::Page {
    fn from(m: pages::Model) -> Self {
        fn parse_dt(src: &str) -> DateTime<Utc> {
            src.parse::<DateTime<Utc>>().unwrap_or_else(|_| Utc::now())
        }
        fn parse_opt(src: &Option<String>) -> Option<DateTime<Utc>> {
            src.as_ref().and_then(|s| s.parse::<DateTime<Utc>>().ok())
        }
        crate::pages::Page {
            id: m.id,
            parent_id: m.parent_id,
            title: m.title,
            cover: m.cover,
            icon: m.icon,
            created_at: parse_dt(&m.created_at),
            updated_at: parse_opt(&m.updated_at),
            deleted_at: parse_opt(&m.deleted_at),
        }
    }
}

impl From<crate::pages::Page> for pages::ActiveModel {
    fn from(p: crate::pages::Page) -> Self {
        use sea_orm::ActiveValue::Set;
        fn fmt_dt(dt: &DateTime<Utc>) -> String {
            dt.to_rfc3339_opts(SecondsFormat::Secs, true)
        }
        pages::ActiveModel {
            id: Set(p.id),
            parent_id: Set(p.parent_id),
            title: Set(p.title),
            cover: Set(p.cover),
            icon: Set(p.icon),
            created_at: Set(fmt_dt(&p.created_at)),
            updated_at: Set(p.updated_at.map(|d| fmt_dt(&d))),
            deleted_at: Set(p.deleted_at.map(|d| fmt_dt(&d))),
        }
    }
}

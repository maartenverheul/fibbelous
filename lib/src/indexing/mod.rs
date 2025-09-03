use std::path::Path;

use crate::migration::Migrator;
use sea_orm::entity::prelude::*;
use sea_orm::sea_query::OnConflict;
use sea_orm::{ConnectOptions, Database, DatabaseConnection, DbErr, Set};
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

/// Tiny smoke test helper: set and get a setting value.
pub async fn set_setting(db: &DatabaseConnection, key: &str, value: &str) -> Result<(), DbErr> {
    use settings::{ActiveModel as SettingsActive, Column as SettingsColumn, Entity as Settings};
    let am = SettingsActive {
        key: Set(key.to_string()),
        value: Set(value.to_string()),
    };
    Settings::insert(am)
        .on_conflict(
            OnConflict::column(SettingsColumn::Key)
                .update_column(SettingsColumn::Value)
                .to_owned(),
        )
        .exec(db)
        .await?;
    Ok(())
}

pub async fn get_setting(db: &DatabaseConnection, key: &str) -> Result<Option<String>, DbErr> {
    use settings::Entity as Settings;
    Ok(Settings::find_by_id(key.to_string())
        .one(db)
        .await?
        .map(|m| m.value))
}

// Entities (optional, used for settings/documents CRUD; schema controlled via migrations)
mod settings {
    use super::*;
    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "settings")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub key: String,
        pub value: String,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

mod documents {
    use super::*;
    #[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
    #[sea_orm(table_name = "documents")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: String,
        pub path: String,
        pub title: Option<String>,
        pub updated_at: i64,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

// Note: schema_migrations table is managed by sea-orm-migration internally

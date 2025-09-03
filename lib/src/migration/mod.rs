use sea_orm_migration::prelude::*;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m20230903_000001_init::Migration)]
    }
}

mod m20230903_000001_init {
    use super::*;

    pub struct Migration;

    #[async_trait::async_trait]
    impl MigrationName for Migration {
        fn name(&self) -> &str {
            "m20230903_000001_init"
        }
    }

    #[async_trait::async_trait]
    impl MigrationTrait for Migration {
        async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            // settings table
            manager
                .create_table(
                    Table::create()
                        .table(Settings::Table)
                        .if_not_exists()
                        .col(
                            ColumnDef::new(Settings::Key)
                                .string()
                                .not_null()
                                .primary_key(),
                        )
                        .col(ColumnDef::new(Settings::Value).string().not_null())
                        .to_owned(),
                )
                .await?;

            // documents table
            manager
                .create_table(
                    Table::create()
                        .table(Documents::Table)
                        .if_not_exists()
                        .col(
                            ColumnDef::new(Documents::Id)
                                .string()
                                .not_null()
                                .primary_key(),
                        )
                        .col(ColumnDef::new(Documents::Path).string().not_null())
                        .col(ColumnDef::new(Documents::Title).string().null())
                        .col(
                            ColumnDef::new(Documents::UpdatedAt)
                                .big_integer()
                                .not_null(),
                        )
                        .to_owned(),
                )
                .await?;

            // index on documents.path
            manager
                .create_index(
                    Index::create()
                        .if_not_exists()
                        .name("idx_documents_path")
                        .table(Documents::Table)
                        .col(Documents::Path)
                        .to_owned(),
                )
                .await?;

            Ok(())
        }

        async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
            manager
                .drop_index(Index::drop().name("idx_documents_path").to_owned())
                .await?;
            manager
                .drop_table(Table::drop().table(Documents::Table).to_owned())
                .await?;
            manager
                .drop_table(Table::drop().table(Settings::Table).to_owned())
                .await?;
            Ok(())
        }
    }

    #[derive(Iden)]
    enum Settings {
        Table,
        Key,
        Value,
    }

    #[derive(Iden)]
    enum Documents {
        Table,
        Id,
        Path,
        Title,
        UpdatedAt,
    }
}

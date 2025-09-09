use sea_orm_migration::prelude::*;

pub struct Migration;

#[async_trait::async_trait]
impl MigrationName for Migration {
    fn name(&self) -> &str {
        "m20250903_000001_pages_init"
    }
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // pages table
        manager
            .create_table(
                Table::create()
                    .table(Pages::Table)
                    .if_not_exists()
                    .col(ColumnDef::new(Pages::Id).string().not_null().primary_key())
                    .col(ColumnDef::new(Pages::ParentId).string().null())
                    .col(ColumnDef::new(Pages::Title).string().not_null())
                    .col(ColumnDef::new(Pages::Cover).string().null())
                    .col(ColumnDef::new(Pages::Icon).string().null())
                    .col(ColumnDef::new(Pages::CreatedAt).string().not_null())
                    .col(ColumnDef::new(Pages::UpdatedAt).string().null())
                    .col(ColumnDef::new(Pages::DeletedAt).string().null())
                    .to_owned(),
            )
            .await?;

        // index on parent_id for quick hierarchy queries
        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_pages_parent_id")
                    .table(Pages::Table)
                    .col(Pages::ParentId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(Index::drop().name("idx_pages_parent_id").to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Pages::Table).to_owned())
            .await?;
        Ok(())
    }
}

#[derive(Iden)]
enum Pages {
    Table,
    Id,
    ParentId,
    Title,
    Cover,
    Icon,
    CreatedAt,
    UpdatedAt,
    DeletedAt,
}

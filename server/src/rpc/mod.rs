use jsonrpsee::{types::ErrorObjectOwned, RpcModule};
use serde::Deserialize;

use crate::pages::{CreatePageInput, UpdatePageInput};
use crate::workspace::Workspace;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListPagesParams {
    #[serde(default)]
    parent_id: Option<String>,
    /// How many levels of descendants to include. `1` = direct children only
    /// (default). `2` nests each child's children under `children`, etc.
    #[serde(default = "default_list_pages_depth")]
    depth: u8,
}

fn default_list_pages_depth() -> u8 {
    1
}

#[derive(Debug, Deserialize)]
struct GetPageParams {
    id: String,
}

#[derive(Debug, Deserialize)]
struct GetDatabaseParams {
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListDatabaseRowsParams {
    id: String,
    #[serde(default)]
    limit: Option<usize>,
    #[serde(default)]
    offset: Option<usize>,
    #[serde(default)]
    sort: Option<crate::databases::DatabaseViewSort>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateDatabaseRowParams {
    id: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    template_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateDatabaseTemplateParams {
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GetDatabaseTemplateParams {
    id: String,
    template_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateDatabaseTemplateParams {
    id: String,
    template_id: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    icon: Option<String>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    attributes: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DatabaseTemplateIdParams {
    id: String,
    template_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateDatabaseParams {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateDatabaseViewParams {
    id: String,
    view_id: String,
    #[serde(flatten)]
    update: crate::databases::DatabaseViewUpdate,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateDatabaseViewParams {
    id: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    layout: Option<crate::databases::DatabaseViewLayout>,
    #[serde(default)]
    copy_from_view_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeleteDatabaseViewParams {
    id: String,
    view_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchPagesParams {
    query: String,
    #[serde(default)]
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePageParams {
    #[serde(default)]
    parent_id: Option<String>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    slug: Option<String>,
    #[serde(default)]
    icon: Option<String>,
    #[serde(default)]
    body: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdatePageParams {
    id: String,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    slug: Option<String>,
    #[serde(default)]
    icon: Option<String>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    body_patch: Option<crate::pages::BodyPatch>,
    #[serde(default)]
    favorite: Option<bool>,
    #[serde(default)]
    attributes: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct TrashPageParams {
    id: String,
}

#[derive(Debug, Deserialize)]
struct RestorePageParams {
    id: String,
}

#[derive(Debug, Deserialize)]
struct PurgePageParams {
    id: String,
}

#[derive(Debug, Deserialize)]
struct DuplicatePageParams {
    id: String,
}

#[derive(Clone)]
pub struct WorkspaceRpcState {
    pub workspace: Workspace,
}

pub fn build_workspace_module(state: WorkspaceRpcState) -> RpcModule<WorkspaceRpcState> {
    let mut module = RpcModule::new(state);

    module
        .register_method("ping", |_, _, _| Ok::<&str, ErrorObjectOwned>("pong"))
        .expect("ping method registration");

    module
        .register_async_method("health", |_, _, _| async move {
            Ok::<&str, ErrorObjectOwned>("ok")
        })
        .expect("health method registration");

    module
        .register_async_method("workspace_info", |_, ctx, _| async move {
            Ok::<serde_json::Value, ErrorObjectOwned>(
                serde_json::to_value(ctx.workspace.info()).unwrap(),
            )
        })
        .expect("workspace_info method registration");

    module
        .register_async_method("list_pages", |params, ctx, _| async move {
            let request: ListPagesParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let parent_id = request.parent_id;
            let depth = request.depth;
            let pages = tokio::task::spawn_blocking(move || {
                workspace.list_pages(parent_id.as_deref(), depth)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(pages).unwrap())
        })
        .expect("list_pages method registration");

    module
        .register_async_method("list_favorite_pages", |_, ctx, _| async move {
            let workspace = ctx.workspace.clone();
            let pages = tokio::task::spawn_blocking(move || workspace.list_favorite_pages())
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(pages).unwrap())
        })
        .expect("list_favorite_pages method registration");

    module
        .register_async_method("get_page", |params, ctx, _| async move {
            let request: GetPageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.get_page(&page_id))
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("get_page method registration");

    module
        .register_async_method("get_database", |params, ctx, _| async move {
            let request: GetDatabaseParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let database =
                tokio::task::spawn_blocking(move || workspace.get_database(&database_id))
                    .await
                    .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                    .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(database).unwrap())
        })
        .expect("get_database method registration");

    module
        .register_async_method("list_databases", |_, ctx, _| async move {
            let workspace = ctx.workspace.clone();
            let databases =
                tokio::task::spawn_blocking(move || workspace.list_databases())
                    .await
                    .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                    .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(databases).unwrap())
        })
        .expect("list_databases method registration");

    module
        .register_async_method("create_database", |params, ctx, _| async move {
            let request: CreateDatabaseParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let title = request.title;
            let parent_id = request.parent_id;
            let result = tokio::task::spawn_blocking(move || {
                workspace.create_database(title, parent_id)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(result).unwrap())
        })
        .expect("create_database method registration");

    module
        .register_async_method("list_database_rows", |params, ctx, _| async move {
            let request: ListDatabaseRowsParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let limit = request.limit;
            let offset = request.offset;
            let sort = request.sort;
            let rows = tokio::task::spawn_blocking(move || {
                workspace.list_database_rows(&database_id, limit, offset, sort)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(rows).unwrap())
        })
        .expect("list_database_rows method registration");

    module
        .register_async_method("update_database_view", |params, ctx, _| async move {
            let request: UpdateDatabaseViewParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let view_id = request.view_id;
            let update = request.update;
            let database = tokio::task::spawn_blocking(move || {
                workspace.update_database_view(&database_id, &view_id, update)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(database).unwrap())
        })
        .expect("update_database_view method registration");

    module
        .register_async_method("create_database_view", |params, ctx, _| async move {
            let request: CreateDatabaseViewParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let input = crate::databases::CreateDatabaseViewInput {
                name: request.name,
                layout: request.layout,
                copy_from_view_id: request.copy_from_view_id,
            };
            let result = tokio::task::spawn_blocking(move || {
                workspace.create_database_view(&database_id, input)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(result).unwrap())
        })
        .expect("create_database_view method registration");

    module
        .register_async_method("delete_database_view", |params, ctx, _| async move {
            let request: DeleteDatabaseViewParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let view_id = request.view_id;
            let database = tokio::task::spawn_blocking(move || {
                workspace.delete_database_view(&database_id, &view_id)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(database).unwrap())
        })
        .expect("delete_database_view method registration");

    module
        .register_async_method("create_database_row", |params, ctx, _| async move {
            let request: CreateDatabaseRowParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let title = request.title;
            let template_id = request.template_id;
            let page = tokio::task::spawn_blocking(move || {
                workspace.create_database_row(&database_id, title, template_id)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("create_database_row method registration");

    module
        .register_async_method("create_database_template", |params, ctx, _| async move {
            let request: CreateDatabaseTemplateParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let result = tokio::task::spawn_blocking(move || {
                workspace.create_database_template(&database_id)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(result).unwrap())
        })
        .expect("create_database_template method registration");

    module
        .register_async_method("get_database_template", |params, ctx, _| async move {
            let request: GetDatabaseTemplateParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let page = tokio::task::spawn_blocking(move || {
                workspace.get_database_template(&database_id, &template_id)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("get_database_template method registration");

    module
        .register_async_method("update_database_template", |params, ctx, _| async move {
            let request: UpdateDatabaseTemplateParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let update = crate::databases::UpdateDatabaseTemplateInput {
                title: request.title,
                icon: request.icon,
                body: request.body,
                attributes: request.attributes,
            };
            let page = tokio::task::spawn_blocking(move || {
                workspace.update_database_template(&database_id, &template_id, update)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("update_database_template method registration");

    module
        .register_async_method("duplicate_database_template", |params, ctx, _| async move {
            let request: DatabaseTemplateIdParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let result = tokio::task::spawn_blocking(move || {
                workspace.duplicate_database_template(&database_id, &template_id)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(result).unwrap())
        })
        .expect("duplicate_database_template method registration");

    module
        .register_async_method("delete_database_template", |params, ctx, _| async move {
            let request: DatabaseTemplateIdParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let database = tokio::task::spawn_blocking(move || {
                workspace.delete_database_template(&database_id, &template_id)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(database).unwrap())
        })
        .expect("delete_database_template method registration");

    module
        .register_async_method("set_default_database_template", |params, ctx, _| async move {
            let request: DatabaseTemplateIdParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let database = tokio::task::spawn_blocking(move || {
                workspace.set_default_database_template(&database_id, &template_id)
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(database).unwrap())
        })
        .expect("set_default_database_template method registration");

    module
        .register_async_method("search_pages", |params, ctx, _| async move {
            let request: SearchPagesParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let query = request.query;
            let limit = request.limit;
            let pages = tokio::task::spawn_blocking(move || workspace.search_pages(&query, limit))
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(pages).unwrap())
        })
        .expect("search_pages method registration");

    module
        .register_async_method("create_page", |params, ctx, _| async move {
            let request: CreatePageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page = tokio::task::spawn_blocking(move || {
                workspace.create_page(CreatePageInput {
                    id: None,
                    parent_id: request.parent_id,
                    title: request.title,
                    slug: request.slug,
                    icon: request.icon,
                    body: request.body,
                    favorite: false,
                })
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("create_page method registration");

    module
        .register_async_method("update_page", |params, ctx, _| async move {
            let request: UpdatePageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page = tokio::task::spawn_blocking(move || {
                workspace.update_page(UpdatePageInput {
                    id: request.id,
                    title: request.title,
                    slug: request.slug,
                    icon: request.icon,
                    body: request.body,
                    body_patch: request.body_patch,
                    favorite: request.favorite,
                    attributes: request.attributes,
                })
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("update_page method registration");

    module
        .register_async_method("trash_page", |params, ctx, _| async move {
            let request: TrashPageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page_id = request.id;
            let trashed_ids = tokio::task::spawn_blocking(move || workspace.trash_page(&page_id))
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(
                serde_json::json!({ "trashedIds": trashed_ids }),
            )
        })
        .expect("trash_page method registration");

    module
        .register_async_method("list_trashed_pages", |_, ctx, _| async move {
            let workspace = ctx.workspace.clone();
            let pages = tokio::task::spawn_blocking(move || workspace.list_trashed_pages())
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(pages).unwrap())
        })
        .expect("list_trashed_pages method registration");

    module
        .register_async_method("get_trashed_page", |params, ctx, _| async move {
            let request: GetPageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.get_trashed_page(&page_id))
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("get_trashed_page method registration");

    module
        .register_async_method("restore_page", |params, ctx, _| async move {
            let request: RestorePageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.restore_page(&page_id))
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("restore_page method registration");

    module
        .register_async_method("purge_page", |params, ctx, _| async move {
            let request: PurgePageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page_id = request.id;
            tokio::task::spawn_blocking(move || workspace.purge_page(&page_id))
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::json!({ "ok": true }))
        })
        .expect("purge_page method registration");

    module
        .register_async_method("duplicate_page", |params, ctx, _| async move {
            let request: DuplicatePageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.duplicate_page(&page_id))
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(page).unwrap())
        })
        .expect("duplicate_page method registration");

    module
        .register_async_method("reindex", |_, ctx, _| async move {
            let workspace = ctx.workspace.clone();
            tokio::task::spawn_blocking(move || workspace.reindex())
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(
                serde_json::to_value(ctx.workspace.info()).unwrap(),
            )
        })
        .expect("reindex method registration");

    module
        .register_async_method("git_status", |_, ctx, _| async move {
            let workspace = ctx.workspace.clone();
            let status = tokio::task::spawn_blocking(move || workspace.git_status())
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(status).unwrap())
        })
        .expect("git_status method registration");

    module
        .register_async_method("git_commit", |_, ctx, _| async move {
            let workspace = ctx.workspace.clone();
            let status = tokio::task::spawn_blocking(move || workspace.git_commit())
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(status).unwrap())
        })
        .expect("git_commit method registration");

    module
        .register_async_method("git_push", |_, ctx, _| async move {
            let workspace = ctx.workspace.clone();
            let status = tokio::task::spawn_blocking(move || workspace.git_push())
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(status).unwrap())
        })
        .expect("git_push method registration");

    module
        .register_async_method("git_pull", |_, ctx, _| async move {
            let workspace = ctx.workspace.clone();
            let status = tokio::task::spawn_blocking(move || workspace.git_pull())
                .await
                .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
                .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(status).unwrap())
        })
        .expect("git_pull method registration");

    module
}

fn params_or_null(params: serde_json::Value) -> serde_json::Value {
    if params.is_null() {
        serde_json::json!({})
    } else {
        params
    }
}

/// Dispatch a workspace RPC method without going through JSON-RPC transport.
/// Used by the Tauri local-folder path so no HTTP/WebSocket server is required.
pub async fn call_workspace_rpc(
    workspace: &Workspace,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    match method {
        "ping" => Ok(serde_json::Value::String("pong".to_owned())),
        "health" => Ok(serde_json::Value::String("ok".to_owned())),
        "workspace_info" => {
            serde_json::to_value(workspace.info()).map_err(|error| error.to_string())
        }
        "list_pages" => {
            let request: ListPagesParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let parent_id = request.parent_id;
            let depth = request.depth;
            let pages = tokio::task::spawn_blocking(move || {
                workspace.list_pages(parent_id.as_deref(), depth)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(pages).map_err(|error| error.to_string())
        }
        "list_favorite_pages" => {
            let workspace = workspace.clone();
            let pages = tokio::task::spawn_blocking(move || workspace.list_favorite_pages())
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(pages).map_err(|error| error.to_string())
        }
        "get_page" => {
            let request: GetPageParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.get_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "get_database" => {
            let request: GetDatabaseParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let database =
                tokio::task::spawn_blocking(move || workspace.get_database(&database_id))
                    .await
                    .map_err(|error| error.to_string())?
                    .map_err(|error| error)?;
            serde_json::to_value(database).map_err(|error| error.to_string())
        }
        "list_databases" => {
            let workspace = workspace.clone();
            let databases = tokio::task::spawn_blocking(move || workspace.list_databases())
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(databases).map_err(|error| error.to_string())
        }
        "create_database" => {
            let request: CreateDatabaseParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let title = request.title;
            let parent_id = request.parent_id;
            let result = tokio::task::spawn_blocking(move || {
                workspace.create_database(title, parent_id)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(result).map_err(|error| error.to_string())
        }
        "list_database_rows" => {
            let request: ListDatabaseRowsParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let limit = request.limit;
            let offset = request.offset;
            let sort = request.sort;
            let rows = tokio::task::spawn_blocking(move || {
                workspace.list_database_rows(&database_id, limit, offset, sort)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(rows).map_err(|error| error.to_string())
        }
        "update_database_view" => {
            let request: UpdateDatabaseViewParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let view_id = request.view_id;
            let update = request.update;
            let database = tokio::task::spawn_blocking(move || {
                workspace.update_database_view(&database_id, &view_id, update)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(database).map_err(|error| error.to_string())
        }
        "create_database_view" => {
            let request: CreateDatabaseViewParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let input = crate::databases::CreateDatabaseViewInput {
                name: request.name,
                layout: request.layout,
                copy_from_view_id: request.copy_from_view_id,
            };
            let result = tokio::task::spawn_blocking(move || {
                workspace.create_database_view(&database_id, input)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(result).map_err(|error| error.to_string())
        }
        "delete_database_view" => {
            let request: DeleteDatabaseViewParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let view_id = request.view_id;
            let database = tokio::task::spawn_blocking(move || {
                workspace.delete_database_view(&database_id, &view_id)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(database).map_err(|error| error.to_string())
        }
        "create_database_row" => {
            let request: CreateDatabaseRowParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let title = request.title;
            let template_id = request.template_id;
            let page = tokio::task::spawn_blocking(move || {
                workspace.create_database_row(&database_id, title, template_id)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "create_database_template" => {
            let request: CreateDatabaseTemplateParams =
                serde_json::from_value(params_or_null(params))
                    .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let result = tokio::task::spawn_blocking(move || {
                workspace.create_database_template(&database_id)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(result).map_err(|error| error.to_string())
        }
        "get_database_template" => {
            let request: GetDatabaseTemplateParams =
                serde_json::from_value(params_or_null(params))
                    .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let page = tokio::task::spawn_blocking(move || {
                workspace.get_database_template(&database_id, &template_id)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "update_database_template" => {
            let request: UpdateDatabaseTemplateParams =
                serde_json::from_value(params_or_null(params))
                    .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let update = crate::databases::UpdateDatabaseTemplateInput {
                title: request.title,
                icon: request.icon,
                body: request.body,
                attributes: request.attributes,
            };
            let page = tokio::task::spawn_blocking(move || {
                workspace.update_database_template(&database_id, &template_id, update)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "duplicate_database_template" => {
            let request: DatabaseTemplateIdParams =
                serde_json::from_value(params_or_null(params))
                    .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let result = tokio::task::spawn_blocking(move || {
                workspace.duplicate_database_template(&database_id, &template_id)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(result).map_err(|error| error.to_string())
        }
        "delete_database_template" => {
            let request: DatabaseTemplateIdParams =
                serde_json::from_value(params_or_null(params))
                    .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let database = tokio::task::spawn_blocking(move || {
                workspace.delete_database_template(&database_id, &template_id)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(database).map_err(|error| error.to_string())
        }
        "set_default_database_template" => {
            let request: DatabaseTemplateIdParams =
                serde_json::from_value(params_or_null(params))
                    .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let database_id = request.id;
            let template_id = request.template_id;
            let database = tokio::task::spawn_blocking(move || {
                workspace.set_default_database_template(&database_id, &template_id)
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(database).map_err(|error| error.to_string())
        }
        "search_pages" => {
            let request: SearchPagesParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let query = request.query;
            let limit = request.limit;
            let pages = tokio::task::spawn_blocking(move || workspace.search_pages(&query, limit))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(pages).map_err(|error| error.to_string())
        }
        "create_page" => {
            let request: CreatePageParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page = tokio::task::spawn_blocking(move || {
                workspace.create_page(CreatePageInput {
                    id: None,
                    parent_id: request.parent_id,
                    title: request.title,
                    slug: request.slug,
                    icon: request.icon,
                    body: request.body,
                    favorite: false,
                })
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "update_page" => {
            let request: UpdatePageParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page = tokio::task::spawn_blocking(move || {
                workspace.update_page(UpdatePageInput {
                    id: request.id,
                    title: request.title,
                    slug: request.slug,
                    icon: request.icon,
                    body: request.body,
                    body_patch: request.body_patch,
                    favorite: request.favorite,
                    attributes: request.attributes,
                })
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "trash_page" => {
            let request: TrashPageParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let trashed_ids = tokio::task::spawn_blocking(move || workspace.trash_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            Ok(serde_json::json!({ "trashedIds": trashed_ids }))
        }
        "list_trashed_pages" => {
            let workspace = workspace.clone();
            let pages = tokio::task::spawn_blocking(move || workspace.list_trashed_pages())
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(pages).map_err(|error| error.to_string())
        }
        "get_trashed_page" => {
            let request: GetPageParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.get_trashed_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "restore_page" => {
            let request: RestorePageParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.restore_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "purge_page" => {
            let request: PurgePageParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            tokio::task::spawn_blocking(move || workspace.purge_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            Ok(serde_json::json!({ "ok": true }))
        }
        "duplicate_page" => {
            let request: DuplicatePageParams = serde_json::from_value(params_or_null(params))
                .map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.duplicate_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "reindex" => {
            let reindex_workspace = workspace.clone();
            tokio::task::spawn_blocking(move || reindex_workspace.reindex())
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(workspace.info()).map_err(|error| error.to_string())
        }
        "git_status" => {
            let workspace = workspace.clone();
            let status = tokio::task::spawn_blocking(move || workspace.git_status())
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(status).map_err(|error| error.to_string())
        }
        "git_commit" => {
            let workspace = workspace.clone();
            let status = tokio::task::spawn_blocking(move || workspace.git_commit())
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(status).map_err(|error| error.to_string())
        }
        "git_push" => {
            let workspace = workspace.clone();
            let status = tokio::task::spawn_blocking(move || workspace.git_push())
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(status).map_err(|error| error.to_string())
        }
        "git_pull" => {
            let workspace = workspace.clone();
            let status = tokio::task::spawn_blocking(move || workspace.git_pull())
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(status).map_err(|error| error.to_string())
        }
        other => Err(format!("unknown method: {other}")),
    }
}

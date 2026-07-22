use jsonrpsee::{RpcModule, types::ErrorObjectOwned};
use serde::Deserialize;

use crate::pages::{CreatePageInput, UpdatePageInput};
use crate::workspace::Workspace;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ListPagesParams {
    #[serde(default)]
    parent_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GetPageParams {
    id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreatePageParams {
    parent_path: String,
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
            let parent_path = request.parent_path;
            let pages = tokio::task::spawn_blocking(move || {
                workspace.list_pages(parent_path.as_deref())
            })
            .await
            .map_err(|error| ErrorObjectOwned::owned(1, error.to_string(), None::<()>))?
            .map_err(|error| ErrorObjectOwned::owned(2, error, None::<()>))?;
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::to_value(pages).unwrap())
        })
        .expect("list_pages method registration");

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
        .register_async_method("create_page", |params, ctx, _| async move {
            let request: CreatePageParams = params.parse()?;
            let workspace = ctx.workspace.clone();
            let page = tokio::task::spawn_blocking(move || {
                workspace.create_page(CreatePageInput {
                    parent_path: request.parent_path,
                    title: request.title,
                    slug: request.slug,
                    icon: request.icon,
                    body: request.body,
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
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::json!({ "trashedIds": trashed_ids }))
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
        "workspace_info" => serde_json::to_value(workspace.info()).map_err(|error| error.to_string()),
        "list_pages" => {
            let request: ListPagesParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let parent_path = request.parent_path;
            let pages = tokio::task::spawn_blocking(move || {
                workspace.list_pages(parent_path.as_deref())
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(pages).map_err(|error| error.to_string())
        }
        "get_page" => {
            let request: GetPageParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.get_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "create_page" => {
            let request: CreatePageParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page = tokio::task::spawn_blocking(move || {
                workspace.create_page(CreatePageInput {
                    parent_path: request.parent_path,
                    title: request.title,
                    slug: request.slug,
                    icon: request.icon,
                    body: request.body,
                })
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "update_page" => {
            let request: UpdatePageParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page = tokio::task::spawn_blocking(move || {
                workspace.update_page(UpdatePageInput {
                    id: request.id,
                    title: request.title,
                    slug: request.slug,
                    icon: request.icon,
                    body: request.body,
                })
            })
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "trash_page" => {
            let request: TrashPageParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
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
            let request: GetPageParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.get_trashed_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "restore_page" => {
            let request: RestorePageParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.restore_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        "purge_page" => {
            let request: PurgePageParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            tokio::task::spawn_blocking(move || workspace.purge_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            Ok(serde_json::json!({ "ok": true }))
        }
        "duplicate_page" => {
            let request: DuplicatePageParams =
                serde_json::from_value(params_or_null(params)).map_err(|error| error.to_string())?;
            let workspace = workspace.clone();
            let page_id = request.id;
            let page = tokio::task::spawn_blocking(move || workspace.duplicate_page(&page_id))
                .await
                .map_err(|error| error.to_string())?
                .map_err(|error| error)?;
            serde_json::to_value(page).map_err(|error| error.to_string())
        }
        other => Err(format!("unknown method: {other}")),
    }
}

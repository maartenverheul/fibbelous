use jsonrpsee::{RpcModule, types::ErrorObjectOwned};
use serde::Deserialize;

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
}

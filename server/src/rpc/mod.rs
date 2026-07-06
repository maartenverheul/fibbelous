use std::sync::Arc;

use jsonrpsee::{RpcModule, types::ErrorObjectOwned};

use crate::workspace::Workspace;

#[derive(Clone)]
pub struct RpcState {
    pub workspaces: Arc<Vec<Workspace>>,
}

pub fn build_module(state: RpcState) -> RpcModule<RpcState> {
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
        .register_async_method("server_info", |_, _, _| async move {
            Ok::<serde_json::Value, ErrorObjectOwned>(serde_json::json!({
                "name": "fibbelous-server",
                "protocol": "json-rpc",
                "transport": "websocket",
            }))
        })
        .expect("server_info method registration");

    module
        .register_async_method("list_workspaces", |_, ctx, _| async move {
            let workspaces: Vec<_> = ctx
                .workspaces
                .iter()
                .map(|workspace| workspace.info())
                .collect();
            Ok::<_, ErrorObjectOwned>(serde_json::to_value(workspaces).unwrap())
        })
        .expect("list_workspaces method registration");

    module
}

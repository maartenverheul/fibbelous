use crate::AppState;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures_util::StreamExt;
use lib::command_handler::{execute, Command, CommandEnv, CommandResult};
use lib::tracing::debug;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct WsConnectParams {
    pub workspace: String,
}

// WebSocket handler now requires ?workspace=<id>
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(params): Query<WsConnectParams>,
) -> impl IntoResponse {
    // Validate workspace exists
    if !state.workspaces.contains_key(&params.workspace) {
        return (
            axum::http::StatusCode::BAD_REQUEST,
            format!("Unknown workspace id: {}", params.workspace),
        )
            .into_response();
    }
    let ws_id = params.workspace.clone();
    ws.on_upgrade(move |socket| handle_socket(socket, state, ws_id))
}

async fn handle_socket(mut socket: WebSocket, state: AppState, workspace_id: String) {
    debug!(target: "ws", "New WebSocket connection established to workspace {}", workspace_id);

    // Send initial greeting
    // if socket
    //     .send(Message::Text("Welcome to Fibbelous WS".into()))
    //     .await
    //     .is_err()
    // {
    //     return;
    // }

    while let Some(Ok(msg)) = socket.next().await {
        match msg {
            Message::Text(t) => {
                // Try JSON parse as Command; if not a command, ignore (no echo)
                match serde_json::from_str::<Command>(&t) {
                    Ok(cmd) => {
                        // Restrict env to the bound workspace only
                        let workspaces: Vec<lib::workspaces::WorkspaceInfo> = state
                            .workspaces
                            .get(&workspace_id)
                            .map(|w| vec![w.info.clone()])
                            .unwrap_or_default();
                        let env = CommandEnv::new(workspaces, vec![]);
                        let res: CommandResult = execute(cmd, &env);
                        let text = encode_result(&res);
                        let _ = socket.send(Message::Text(text)).await;
                    }
                    Err(_) => { /* ignore */ }
                }
            }
            Message::Binary(_bin) => { /* ignore */ }
            Message::Close(_) => {
                let _ = socket.send(Message::Close(None)).await; // Attempt polite close
                debug!(target: "ws", "WebSocket connection closed by client");
                break;
            }
            Message::Ping(p) => {
                if socket.send(Message::Pong(p)).await.is_err() {
                    break;
                }
            }
            Message::Pong(_) => { /* ignore */ }
        }
    }
}

fn encode_result(res: &CommandResult) -> String {
    match res {
        CommandResult::Void => "{\"type\":\"void\"}".to_string(),
        CommandResult::Bool(b) => format!("{{\"type\":\"bool\",\"value\":{}}}", b),
        CommandResult::Connections(list) => serde_json::json!({
            "type": "connections",
            "connections": list
        })
        .to_string(),
        CommandResult::Workspaces(list) => serde_json::json!({
            "type": "workspaces",
            "workspaces": list
        })
        .to_string(),
        CommandResult::Pong => "{\"type\":\"pong\"}".to_string(),
        CommandResult::AddLocal(r) => serde_json::json!({
            "type": "addLocal",
            "result": r
        })
        .to_string(),
        CommandResult::Page(p) => serde_json::json!({
            "type": "page",
            "page": p
        })
        .to_string(),
        CommandResult::PageWithContent(pwc) => serde_json::json!({
            "type": "pageWithContent",
            "data": pwc
        })
        .to_string(),
        CommandResult::Error(e) => serde_json::json!({
            "type": "error",
            "message": e
        })
        .to_string(),
    }
}

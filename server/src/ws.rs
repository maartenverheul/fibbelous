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

#[derive(Deserialize)]
struct IncomingMessageRaw {
    id: String,
    #[serde(rename = "type")]
    cmd_type: String,
    #[serde(default)]
    payload: serde_json::Value,
}

// WebSocket handler now requires ?workspace=<id>
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(params): Query<WsConnectParams>,
) -> impl IntoResponse {
    // Validate workspace exists
    {
        let guard = state.workspaces.read().await;
        if !guard.contains_key(&params.workspace) {
            return (
                axum::http::StatusCode::BAD_REQUEST,
                format!("Unknown workspace id: {}", params.workspace),
            )
                .into_response();
        }
    }
    let ws_id = params.workspace.clone();
    ws.on_upgrade(move |socket| handle_socket(socket, state, ws_id))
}

async fn handle_socket(mut socket: WebSocket, state: AppState, workspace_id: String) {
    debug!(target: "ws", "New WebSocket connection established to workspace {}", workspace_id);

    while let Some(Ok(msg)) = socket.next().await {
        match msg {
            Message::Text(t) => {
                debug!(target: "ws", "RX: {}", &t);
                let raw: IncomingMessageRaw = match serde_json::from_str(&t) {
                    Ok(v) => v,
                    Err(e) => {
                        debug!(target: "ws", "Invalid message (expected envelope) : {}", e);
                        continue;
                    }
                };
                let cmd = match map_raw_command(&raw) {
                    Ok(c) => c,
                    Err(err) => {
                        let err_json = serde_json::json!({
                            "id": raw.id,
                            "type": "error",
                            "message": err
                        });
                        let _ = socket.send(Message::Text(err_json.to_string())).await;
                        continue;
                    }
                };
                let (workspaces, workspace_path) = {
                    let guard = state.workspaces.read().await;
                    if let Some(ws) = guard.get(&workspace_id) {
                        (vec![ws.info.clone()], Some(ws.path.clone()))
                    } else {
                        (Vec::new(), None)
                    }
                };
                let env = CommandEnv::new(workspaces, vec![]).with_workspace_path(workspace_path);
                let res: CommandResult = execute(cmd, &env).await;
                let text = encode_result(Some(raw.id.as_str()), &res);
                if let Err(e) = socket.send(Message::Text(text)).await {
                    debug!(target: "ws", "Send failed (closing): {}", e);
                    break;
                }
            }
            Message::Binary(_bin) => { /* ignore */ }
            Message::Close(_) => {
                // Don't attempt another send; socket is in closing state.
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

fn encode_result(id: Option<&str>, res: &CommandResult) -> String {
    use serde_json::json;
    match res {
        CommandResult::Void => json!({"id": id, "type": "void"}).to_string(),
        CommandResult::Bool(b) => {
            json!({"id": id, "type": "bool", "payload": {"value": b}}).to_string()
        }
        CommandResult::Connections(list) => {
            json!({"id": id, "type": "connections", "payload": {"connections": list}}).to_string()
        }
        CommandResult::CreateWorkspace(result) => {
            json!({"id": id, "type": "createWorkspace", "payload": result}).to_string()
        }
        CommandResult::Workspaces(list) => {
            json!({"id": id, "type": "workspaces", "payload": {"workspaces": list}}).to_string()
        }
        CommandResult::Pong => json!({"id": id, "type": "pong"}).to_string(),
        CommandResult::AddLocal(r) => {
            json!({"id": id, "type": "addLocal", "payload": r}).to_string()
        }
        CommandResult::Page(p) => json!({"id": id, "type": "page", "payload": p}).to_string(),
        CommandResult::PageWithContent(pwc) => {
            json!({"id": id, "type": "pageWithContent", "payload": pwc}).to_string()
        }
        CommandResult::Error(e) => {
            json!({"id": id, "type": "error", "payload": {"message": e}}).to_string()
        }
    }
}

fn map_raw_command(raw: &IncomingMessageRaw) -> Result<Command, String> {
    // Accept both camelCase and snake_case keys for command types for flexibility
    let t = raw.cmd_type.as_str();
    let p = &raw.payload;
    match t {
        "ping" => Ok(Command::Ping),
        "getSavedWorkspaces" | "get_saved_workspaces" => Ok(Command::GetSavedWorkspaces),
        "getSavedConnections" | "get_saved_connections" => Ok(Command::GetSavedConnections),
        "createNewPage" | "create_new_page" => {
            let parent = p
                .get("parent")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            Ok(Command::CreateNewPage { parent })
        }
        // Additional mappings as needed
        other => Err(format!("Unknown command type: {}", other)),
    }
}

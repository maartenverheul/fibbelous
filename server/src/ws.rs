use crate::AppState;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures_util::StreamExt;
use core::command_handler::{execute, Command, CommandEnv, CommandResult, ErrorPayload};
use core::tracing::debug;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct WsConnectParams {
    pub workspace: String,
}

#[derive(Deserialize)]
struct IncomingEnvelope {
    id: Option<String>,
    #[serde(flatten)]
    command: Command,
}

#[derive(serde::Serialize)]
struct OutgoingEnvelope<'a> {
    id: Option<&'a str>,
    #[serde(flatten)]
    result: &'a CommandResult,
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
                let raw: IncomingEnvelope = match serde_json::from_str(&t) {
                    Ok(v) => v,
                    Err(e) => {
                        debug!(target: "ws", "Invalid message (expected envelope) : {}", e);
                        continue;
                    }
                };
                let cmd = raw.command.clone();
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
                let id_ref = raw.id.as_deref();
                let text = match serde_json::to_string(&OutgoingEnvelope {
                    id: id_ref,
                    result: &res,
                }) {
                    Ok(s) => s,
                    Err(e) => {
                        let fallback = CommandResult::Error(ErrorPayload {
                            message: format!("Serialization error: {}", e),
                        });
                        serde_json::to_string(&OutgoingEnvelope {
                            id: id_ref,
                            result: &fallback,
                        })
                        .unwrap_or_else(|_| "{}".into())
                    }
                };
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

// encode_result + manual mapping removed: serde handles via tagged enums.

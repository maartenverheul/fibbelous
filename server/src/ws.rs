use crate::AppState;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use core::command_handler::{execute, Command, CommandEnv, CommandResult, ErrorPayload};
use core::state::WorkspaceState;
use core::tracing::debug;
use futures_util::StreamExt;
use serde::Deserialize;
use std::sync::Arc;

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
    // Capture the workspace state Arc now so subsequent messages don't re-lock the map.
    let ws_state: Arc<WorkspaceState> = {
        let guard = state.workspaces.read().await;
        guard
            .get(&params.workspace)
            .cloned()
            .expect("workspace existence checked above")
    };
    ws.on_upgrade(move |socket| handle_socket(socket, state, ws_state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState, workspace: Arc<WorkspaceState>) {
    debug!(target: "ws", "New WebSocket connection established to workspace {}", workspace.id);

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
                // Build command environment with the active workspace's DB
                let mut env = CommandEnv::new(vec![workspace.info.clone()], vec![])
                    .with_workspace_path(Some(workspace.path.clone()));
                env.workspace_dbs
                    .insert(workspace.id.clone(), workspace.db.clone());
                env.active_workspace_id = Some(workspace.id.clone());
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

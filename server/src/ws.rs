use crate::AppState;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use fib_core::command_handler::{Command, CommandHandler, CommandResult, ErrorPayload};
use fib_core::tracing::debug;
use fib_core::workspaces::LoadedWorkspace;
use futures_util::StreamExt;
use hyper::StatusCode;
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

    let workspace = {
        let guard = state.workspace_manager.workspaces.read().await;
        guard.get(&params.workspace).cloned()
    };

    match workspace {
        None => (
            StatusCode::BAD_REQUEST,
            format!("Unknown workspace id: {}", params.workspace),
        )
            .into_response(),
        Some(workspace) => {
            ws.on_upgrade(move |socket| handle_socket(socket, state.clone(), workspace))
        }
    }
}

async fn handle_socket(mut socket: WebSocket, state: AppState, workspace: Arc<LoadedWorkspace>) {
    debug!(target: "ws", "New WebSocket connection established to workspace {}", workspace.id);
    let handler = CommandHandler::new(state.clone(), workspace);

    while let Some(Ok(msg)) = socket.next().await {
        match msg {
            Message::Text(t) => {
                let raw: IncomingEnvelope = match serde_json::from_str(&t) {
                    Ok(v) => v,
                    Err(e) => {
                        debug!(target: "ws", "Invalid message (expected envelope) : {}", e);
                        // Build and send an error response back to client
                        let err = CommandResult::Error(ErrorPayload {
                            message: format!("Invalid message: {}", e),
                        });
                        if let Ok(text) = serde_json::to_string(&OutgoingEnvelope {
                            id: None,
                            result: &err,
                        }) {
                            // Ignore send error (client may have closed)
                            let _ = socket.send(Message::Text(text)).await;
                        }
                        continue;
                    }
                };
                let cmd = raw.command.clone();
                let res: CommandResult = handler.execute(cmd).await;
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

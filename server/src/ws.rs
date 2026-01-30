use crate::AppState;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{Query, State, WebSocketUpgrade};
use axum::response::IntoResponse;
use fib_core::command_handler::{Command, CommandHandler, CommandResult, ErrorPayload};
use fib_core::tracing::debug;
use fib_core::users::{ConnectedUserContext, UserInfo};
use fib_core::workspaces::LoadedWorkspace;
use futures_util::StreamExt;
use hyper::StatusCode;
use serde::Deserialize;
use std::sync::Arc;
use tokio::sync::broadcast::error::RecvError;
use tokio::sync::RwLock;

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
    State(state): State<Arc<AppState>>,
    Query(params): Query<WsConnectParams>,
) -> impl IntoResponse {
    // Validate workspace exists

    let workspace = state.workspaces.get(&params.workspace).await;

    match workspace {
        None => (
            StatusCode::BAD_REQUEST,
            format!("Unknown workspace id: {}", params.workspace),
        )
            .into_response(),
        Some(workspace) => ws.on_upgrade(move |socket| handle_socket(socket, state, workspace)),
    }
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>, workspace: Arc<LoadedWorkspace>) {
    debug!(target: "ws", "New WebSocket connection established to workspace {:?}", workspace.info.slug);

    let dummy_user = UserInfo {
        id: 0,
        username: "ws_user".into(),
        email: "ws_user@example.com".into(),
        is_admin: false,
        created_at: "".into(),
        updated_at: "".into(),
    };

    let user_context = ConnectedUserContext {
        info: dummy_user,
        token: None,
        active_workspace: RwLock::new(Some(workspace.clone())),
        command_handler: CommandHandler::new(state, Some(workspace.clone())),
    };

    let mut ws_stream = socket;
    let mut events_rx = workspace.events_tx.subscribe();

    loop {
        tokio::select! {
            maybe_msg = ws_stream.next() => {
                match maybe_msg {
                    Some(Ok(Message::Text(t))) => {
                        let raw: IncomingEnvelope = match serde_json::from_str(&t) {
                            Ok(v) => v,
                            Err(e) => {
                                debug!(target: "ws", "Invalid message (expected envelope) : {}", e);
                                let err = CommandResult::Error(ErrorPayload { message: format!("Invalid message: {}", e) });
                                if let Ok(text) = serde_json::to_string(&OutgoingEnvelope { id: None, result: &err }) {
                                    let _ = ws_stream.send(Message::Text(text)).await;
                                }
                                continue;
                            }
                        };
                        let cmd = raw.command.clone();
                        let res = user_context.command_handler.execute(cmd).await;
                        let id_ref = raw.id.as_deref();
                        let text = match serde_json::to_string(&OutgoingEnvelope { id: id_ref, result: &res }) {
                            Ok(s) => s,
                            Err(e) => {
                                let fallback = CommandResult::Error(ErrorPayload { message: format!("Serialization error: {}", e) });
                                serde_json::to_string(&OutgoingEnvelope { id: id_ref, result: &fallback }).unwrap_or_else(|_| "{}".into())
                            }
                        };
                        if let Err(e) = ws_stream.send(Message::Text(text)).await { debug!(target: "ws", "Send failed (closing): {}", e); break; }
                    }
                    Some(Ok(Message::Binary(_))) => {/* ignore */}
                    Some(Ok(Message::Close(_))) => { debug!(target: "ws", "WebSocket connection closed by client"); break; }
                    Some(Ok(Message::Ping(p))) => { if ws_stream.send(Message::Pong(p)).await.is_err() { break; } }
                    Some(Ok(Message::Pong(_))) => {/* ignore */}
                    Some(Err(e)) => { debug!(target: "ws", "WebSocket error: {}", e); break; }
                    None => break,
                }
            },
            evt = events_rx.recv() => {
                match evt {
                    Ok(event) => {
                        if let Ok(text) = serde_json::to_string(&event) {
                            if ws_stream.send(Message::Text(text)).await.is_err() { break; }
                        }
                    }
                    Err(RecvError::Lagged(skipped)) => {
                        debug!(target: "ws", "Lagged over {} events", skipped);
                    }
                    Err(RecvError::Closed) => break,
                }
            }
        }
    }
}

// encode_result + manual mapping removed: serde handles via tagged enums.

use crate::AppState;
use axum::extract::ws::{Message, WebSocket};
use axum::extract::{State, WebSocketUpgrade};
use axum::response::IntoResponse;
use futures_util::StreamExt;
use lib::tracing::debug;

// Basic websocket handler that echoes messages and sends a greeting.
pub async fn ws_handler(ws: WebSocketUpgrade, State(_state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(handle_socket)
}

async fn handle_socket(mut socket: WebSocket) {
    debug!(target: "ws", "New WebSocket connection established");

    // Send initial greeting
    if socket
        .send(Message::Text("Welcome to Fibbelous WS".into()))
        .await
        .is_err()
    {
        return;
    }

    while let Some(Ok(msg)) = socket.next().await {
        match msg {
            Message::Text(t) => {
                // Simple echo with prefix
                if socket
                    .send(Message::Text(format!("echo: {}", t)))
                    .await
                    .is_err()
                {
                    break;
                }
            }
            Message::Binary(bin) => {
                if socket.send(Message::Binary(bin)).await.is_err() {
                    break;
                }
            }
            Message::Close(_) => {
                let _ = socket.send(Message::Close(None)).await; // Attempt polite close
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

use std::net::SocketAddr;

use axum::{extract::State, response::IntoResponse, routing::get, Router};
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tracing::info;

#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<String>,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    user: String,
    text: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    let (tx, _rx) = broadcast::channel::<String>(100);

    let app_state = AppState { tx };

    let app = Router::new()
        .route("/ws", get(ws_handler))
        .with_state(app_state);

    let addr: SocketAddr = SocketAddr::from(([0, 0, 0, 0], 3001));
    info!("starting websocket server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    // Task to forward broadcast messages to this client
    let send_task = tokio::spawn(async move {
        while let Ok(text) = rx.recv().await {
            if sender.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
    });

    // Receive messages from this client and broadcast
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                let payload = match serde_json::from_str::<ChatMessage>(&text) {
                    Ok(chat) => serde_json::to_string(&chat).unwrap(),
                    Err(_) => serde_json::to_string(&ChatMessage { user: "anon".to_string(), text }).unwrap(),
                };
                let _ = state.tx.send(payload);
            }
            Message::Binary(_) => {}
            Message::Ping(_) => {}
            Message::Pong(_) => {}
            Message::Close(_) => break,
        }
    }

    send_task.abort();
}

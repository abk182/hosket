use std::net::SocketAddr;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::{Router, routing::get};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tracing::info;
#[derive(Serialize, Deserialize)]
struct ChatMessage {
    user: String,
    text: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let (tx, _rx) = broadcast::channel::<String>(100);

    let app = Router::new().route(
        "/ws/chat",
        get(async |ws: WebSocketUpgrade| ws.on_upgrade(move |socket| handle_socket(socket, tx))),
    );

    let addr: SocketAddr = SocketAddr::from(([0, 0, 0, 0], 3001));
    info!("starting websocket server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handle_socket(socket: WebSocket, tx: tokio::sync::broadcast::Sender<String>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = tx.subscribe();

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
                    Err(_) => serde_json::to_string(&ChatMessage {
                        user: "anon".to_string(),
                        text,
                    })
                    .unwrap(),
                };
                let _ = tx.send(payload);
            }
            Message::Binary(_) => {}
            Message::Ping(_) => {}
            Message::Pong(_) => {}
            Message::Close(_) => break,
        }
    }

    send_task.abort();
}

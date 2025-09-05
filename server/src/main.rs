use std::net::SocketAddr;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::{Router, routing::get};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tracing::info;

#[derive(Serialize, Deserialize)]
struct Step {
    id: i32,
    coords: [i32; 2],
    color: String,
}

#[derive(Serialize, Deserialize)]
struct ChatMessage {
    user: String,
    text: Option<String>,
    step: Option<Step>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("info").init();

    // TODO: use separate channels for chat and canvas messages;
    let (tx, _rx) = broadcast::channel::<String>(100);

    let tx_chat = tx.clone();
    let tx_canvas = tx.clone();

    let app = Router::new()
        .route(
            "/ws/chat",
            get(async |ws: WebSocketUpgrade| {
                ws.on_upgrade(move |socket| handle_socket(socket, tx_chat))
            }),
        )
        .route(
            "/ws/canvas",
            get(async |ws: WebSocketUpgrade| {
                ws.on_upgrade(move |socket| handle_socket(socket, tx_canvas))
            }),
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
                        text: Some(text),
                        step: None,
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

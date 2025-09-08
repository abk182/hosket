use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::State;
use axum::{routing::get, Router};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct Step {
    id: i32,
    coords: [i32; 2],
    color: String,
}

#[derive(Serialize, Deserialize)]
struct WsMessage {
    user: String,
    step: Option<Step>,
}

pub fn router(tx: tokio::sync::broadcast::Sender<String>) -> Router {
    Router::new()
        .route("/ws/canvas", get(ws_handler))
        .with_state(tx)
}

async fn ws_handler(
    State(tx): State<tokio::sync::broadcast::Sender<String>>,
    ws: WebSocketUpgrade,
) -> axum::response::Response {
    ws.on_upgrade(move |socket| handle_socket(socket, tx))
}

async fn handle_socket(socket: WebSocket, tx: tokio::sync::broadcast::Sender<String>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = tx.subscribe();

    let send_task = tokio::spawn(async move {
        while let Ok(text) = rx.recv().await {
            if sender.send(Message::Text(text)).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                let payload = match serde_json::from_str::<WsMessage>(&text) {
                    Ok(chat) => serde_json::to_string(&chat).unwrap(),
                    Err(_) => serde_json::to_string(&WsMessage {
                        user: "anon".to_string(),
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



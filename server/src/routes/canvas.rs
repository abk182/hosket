use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::{Json, Router, routing::get};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

#[derive(Clone, Serialize, Deserialize, Debug)]
struct Step {
    id: i32,
    user: String,
    coords: Vec<i32>,
    color: String,
}

type WsMessages = Arc<Mutex<Vec<Step>>>;

pub fn router(tx: broadcast::Sender<String>) -> Router {
    let messages: WsMessages = Arc::new(Mutex::new(Vec::new()));

    // Provide both tx and shared messages via a tuple
    Router::new()
        .route("/api/ws/canvas", get(ws_handler))
        .route("/api/canvas/messages", get(get_messages))
        .with_state((tx, messages))
}

async fn ws_handler(
    State((tx, messages)): State<(broadcast::Sender<String>, WsMessages)>,
    ws: WebSocketUpgrade,
) -> axum::response::Response {
    ws.on_upgrade(move |socket| handle_socket(socket, tx, messages))
}

async fn handle_socket(socket: WebSocket, tx: broadcast::Sender<String>, messages: WsMessages) {
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
                let parsed = match serde_json::from_str::<Step>(&text) {
                    Ok(msg) => Some(msg),
                    Err(_) => None,
                };

                if let Some(msg) = parsed {
                    {
                        let mut guard = messages.lock().unwrap();
                        guard.push(msg.clone());
                    }
                    let payload = serde_json::to_string(&msg).unwrap();
                    let _ = tx.send(payload);
                } else {
                    let fallback = Step {
                        id: -1,
                        user: "anon".to_string(),
                        coords: vec![],
                        color: "red".to_string(),
                    };
                    let payload = serde_json::to_string(&fallback).unwrap();
                    let _ = tx.send(payload);
                }
            }
            Message::Binary(_) => {}
            Message::Ping(_) => {}
            Message::Pong(_) => {}
            Message::Close(_) => break,
        }
    }

    send_task.abort();
}

async fn get_messages(
    State((_, messages)): State<(broadcast::Sender<String>, WsMessages)>,
) -> Json<Vec<Step>> {
    let snapshot = {
        let guard = messages.lock().unwrap();
        guard.clone()
    };

    let mut steps_map: HashMap<i32, Step> = HashMap::new();

    for step in snapshot {
        match steps_map.get_mut(&step.id) {
            Some(existing) => {
                existing.coords.extend(step.coords);
            }
            None => {
                steps_map.insert(step.id, step);
            }
        }
    }

    let mut result: Vec<Step> = steps_map.into_values().collect();
    result.sort_by_key(|s| s.id);
    Json(result)
}

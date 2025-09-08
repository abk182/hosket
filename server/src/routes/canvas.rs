use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::extract::State;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::{Json, Router, routing::get};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use std::collections::hash_map::Entry::Occupied;
use std::collections::hash_map::Entry::Vacant;

#[derive(Clone, Serialize, Deserialize, Debug)]
struct Step {
    id: i32,
    coords: Vec<i32>,
    color: String,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
struct WsMessage {
    user: String,
    step: Option<Step>,
}

type WsMessages = Arc<Mutex<Vec<WsMessage>>>;

pub fn router(tx: broadcast::Sender<String>) -> Router {
    let messages: WsMessages = Arc::new(Mutex::new(Vec::new()));

    // Provide both tx and shared messages via a tuple
    Router::new()
        .route("/ws/canvas", get(ws_handler))
        .route("/canvas/messages", get(get_messages))
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
                let parsed = match serde_json::from_str::<WsMessage>(&text) {
                    Ok(msg) => Some(msg),
                    Err(_) => None,
                };

                if let Some(msg) = parsed {
                    {
                        let mut guard = messages.lock().unwrap();
                        guard.push(WsMessage {
                            user: msg.user.clone(),
                            step: msg.step.clone(),
                        });
                    }
                    let payload = serde_json::to_string(&msg).unwrap();
                    let _ = tx.send(payload);
                } else {
                    let fallback = WsMessage {
                        user: "anon".to_string(),
                        step: None,
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
) -> Json<HashMap<String, Vec<Step>>> {
    let snapshot = {
        let guard = messages.lock().unwrap();
        guard.clone()
    };

    let mut grouped: HashMap<String, Vec<Step>> = HashMap::new();
    for msg in snapshot.into_iter() {
        if let Some(step) = msg.step {
            grouped.entry(msg.user).or_default().push(step);
        }
    }

    for steps in grouped.values_mut() {
        let mut steps_map: HashMap<String, Step> = HashMap::new();
        for step in std::mem::take(steps) {
            match steps_map.entry(step.id.to_string()) {
                Occupied(mut s) => {
                    for coord in &step.coords {
                        s.get_mut().coords.push(*coord);
                    }
                }
                Vacant(_) => {
                    steps_map.entry(step.id.to_string()).or_insert(step.clone());
                }
            }
        }
        steps.extend(steps_map.into_values());
    }

    Json(grouped)
}

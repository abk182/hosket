use std::net::SocketAddr;

use axum::Router;
use tokio::sync::broadcast;
use tracing::info;

mod routes;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("info").init();

    // TODO: use separate channels for chat and canvas messages;
    let (tx, _rx) = broadcast::channel::<String>(100);

    let tx_chat = tx.clone();
    let tx_canvas = tx.clone();

    let app = Router::new()
        .merge(routes::chat::router(tx_chat))
        .merge(routes::canvas::router(tx_canvas));

    let addr: SocketAddr = SocketAddr::from(([0, 0, 0, 0], 3001));
    info!("starting websocket server on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
// routes are implemented in routes/ws.rs

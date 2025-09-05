#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

SERVER_CMD="cd \"$ROOT_DIR/server\" && cargo run"
CLIENT_CMD="cd \"$ROOT_DIR/client\" && npm run dev"

SERVER_LOG="$ROOT_DIR/server.out"
CLIENT_LOG="$ROOT_DIR/client.out"

server_pid=""
client_pid=""

cleanup() {
  echo "\nStopping processes..."
  if [ -n "$server_pid" ] && kill -0 "$server_pid" 2>/dev/null; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  if [ -n "$client_pid" ] && kill -0 "$client_pid" 2>/dev/null; then
    kill "$client_pid" 2>/dev/null || true
    wait "$client_pid" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

echo "Starting server... (logs: $SERVER_LOG)"
sh -lc "$SERVER_CMD" >"$SERVER_LOG" 2>&1 &
server_pid=$!

echo "Starting client... (logs: $CLIENT_LOG)"
sh -lc "$CLIENT_CMD" >"$CLIENT_LOG" 2>&1 &
client_pid=$!

echo "Server PID: $server_pid"
echo "Client PID: $client_pid"

echo "Tailing logs (Ctrl+C to stop)"
# Tail both logs; exit when any process exits
# Use separate tails in background and wait on children
( tail -f "$SERVER_LOG" & tail -f "$CLIENT_LOG" & wait ) 
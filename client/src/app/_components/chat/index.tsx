"use client";

import { getUrl } from "@/app/_utils/url";
import { useEffect, useRef, useState } from "react";

const wsUrl = getUrl("ws/chat", 'ws');

export default function Chat({
  username,
  onChangeUsername,
}: {
  username: string;
  onChangeUsername: (username: string) => void;
}) {
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (ev) => {
      try {
        const data: WsMessage = JSON.parse(ev.data);
        setMessages((prev) => [...prev, data]);
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [wsUrl]);

  const sendMessage = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!input.trim()) return;
    const payload: WsMessage = { user: username, text: input.trim() };
    wsRef.current.send(JSON.stringify(payload));
    setInput("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto] gap-4 p-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Chat</h1>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-green-500" : "bg-red-500"
            }`}
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            value={username}
            onChange={(e) => onChangeUsername(e.target.value)}
            placeholder="username"
          />
        </div>
      </header>

      <main
        className="border rounded p-3 overflow-y-auto bg-white/5"
        style={{ maxHeight: "60vh" }}
      >
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">No messages yet.</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{m.user}:</span>{" "}
                <span>{m.text}</span>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="flex gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message and press Enter"
        />
        <button
          className="border rounded px-4 py-2 bg-foreground text-background disabled:opacity-50"
          onClick={sendMessage}
          disabled={!connected || !input.trim()}
        >
          Send
        </button>
      </footer>
    </div>
  );
}

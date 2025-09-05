"use client";

import { getWsUrl } from "@/app/_utils/ws-url";

import { useCallback, useEffect, useRef, useState } from "react";
import draw from "./draw";

const wsUrl = getWsUrl("canvas");

type Coordinates = { x?: number; y?: number };

export default function Canvas({ username }: { username: string }) {
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<{ [user: string]: Coordinates }>({ [username]: {} });

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const payload: WsMessage = {
      user: username,
      text: `{"x": ${x}, "y": ${y}}`,
    };
    wsRef.current?.send(JSON.stringify(payload));
    inputRef.current = { ...inputRef.current, [username]: { x, y } };
    draw(canvasRef.current, inputRef.current);
  };

  const handleMouseLeave = () => {
    inputRef.current = { ...inputRef.current, [username]: {} };
    draw(canvasRef.current, inputRef.current);
  };

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (ev) => {
      try {
        const data: WsMessage = JSON.parse(ev.data);

        if (username === data.user) return;

        const parsedCoords: Coordinates = JSON.parse(data.text);

        inputRef.current = { ...inputRef.current, [username]: parsedCoords };

        draw(canvasRef.current, inputRef.current);
      } catch (e) {
        console.log("error!", e);
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

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto] gap-4 p-4 max-w-2xl mx-auto">
      <main className="border rounded p-3 overflow-y-auto bg-white/5">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </main>
    </div>
  );
}

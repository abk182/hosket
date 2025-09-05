"use client";

import { getWsUrl } from "@/app/_utils/ws-url";

import { useCallback, useEffect, useRef, useState } from "react";
import { getRandomHexColor } from "./hex";

const wsUrl = getWsUrl("canvas");

type Input = { x?: number; y?: number; color?: string };

export default function Canvas({ username }: { username: string }) {
  const [connected, setConnected] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<{
    [user: string]: Input;
  }>({ [username]: {} });

  const draw = useCallback(({ x, y, color }: Input) => {
    const canvas = canvasRef.current;

    if (!canvas || !x || !y || !color) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas
    // ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  }, []);

  const sendPosition = useCallback(
    (x: number, y: number) => {
      const color = inputRef.current[username]?.color || getRandomHexColor();

      const payload: WsMessage = {
        user: username,
        text: `{"x": ${x}, "y": ${y}, "color": "${color}"}`,
      };
      wsRef.current?.send(JSON.stringify(payload));
      inputRef.current = {
        ...inputRef.current,
        [username]: {
          x,
          y,
          color,
        },
      };
      draw(inputRef.current[username]);
    },
    [username]
  );

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    sendPosition(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    sendPosition(x, y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseLeave = () => {
    setIsDrawing(false);
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

        const parsed: Input = JSON.parse(data.text);

        inputRef.current = { ...inputRef.current, [data.user]: parsed };

        draw(parsed);
      } catch (e) {
        console.log("error!", e);
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [wsUrl, username]);

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto] gap-4 p-4 max-w-2xl mx-auto">
      <main className="border rounded p-3 overflow-y-auto bg-white/5">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
      </main>
    </div>
  );
}

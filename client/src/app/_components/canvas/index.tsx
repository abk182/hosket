"use client";

import { getWsUrl } from "@/app/_utils/ws-url";
import { throttle } from "lodash";
// import throttle from "lodash/throttle";

import { useCallback, useEffect, useRef, useState } from "react";

const wsUrl = getWsUrl("canvas");

type Coordinates = { x?: number; y?: number };

export default function Canvas({ username }: { username: string }) {
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [input, setInput] = useState<{
    [user: string]: Coordinates;
  }>({
    [username]: {},
  });
  const throttledSetInput = useCallback(throttle(setInput, 50), []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const payload: WsMessage = {
      user: username,
      text: `{"x": ${x}, "y": ${y}}`,
    };
    wsRef.current?.send(JSON.stringify(payload));
    throttledSetInput((prev) => ({ ...prev, [username]: { x, y } }));
  };

  const handleMouseLeave = () => {
    throttledSetInput((prev) => ({ ...prev, [username]: {} }));
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

        throttledSetInput((prev) => ({ ...prev, [data.user]: parsedCoords }));
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

  useEffect(() => {
    console.log(input);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    Object.keys(input).forEach((key) => {
      const { x, y } = input[key];

      if (x && y) {
        ctx.fillStyle = "#ef4444"; // red-500
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }, [input]);

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto] gap-4 p-4 max-w-2xl mx-auto">
      <main className="border rounded p-3 overflow-y-auto bg-white/5">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </main>
      <div>
        {connected &&
          Object.keys(input).map((key) => (
            <div key={key} className="mt-2 text-sm">
              {`${key}: x - ${input[key].x} y - ${input[key].y}`}
            </div>
          ))}
      </div>
    </div>
  );
}

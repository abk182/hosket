"use client";

import { getWsUrl } from "@/app/_utils/ws-url";

import { useEffect, useRef, useState } from "react";
import { getRandomHexColor } from "./hex";

const wsUrl = getWsUrl("canvas");

export default function Canvas({ username }: { username: string }) {
  const [connected, setConnected] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<{
    [user: string]: Array<Step>;
  }>({});

  const drawStep = ({ coords, color }: Step) => {
    const canvas = canvasRef.current;

    if (!canvas || !coords || !color) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = color;

    for (let i = 0; i < coords.length - 4; i += 2) {
      const start = { x: coords[i], y: coords[i + 1] };
      const end = { x: coords[i + 2], y: coords[i + 3] };

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    console.log(inputRef.current);

    Object.keys(inputRef.current).forEach((user) => {
      inputRef.current[user].forEach((step) => {
        drawStep(step);
      });
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    let id = 0;
    let color = getRandomHexColor();

    if (inputRef.current[username] == null) {
      inputRef.current[username] = [];
    } else {
      const lastStep =
        inputRef.current[username][inputRef.current[username].length - 1];

      if (lastStep?.id != null) {
        id = lastStep.id + 1;
        color = lastStep.color;
      }
    }

    const newStep: Step = {
      id,
      coords: [x, y],
      color,
    };
    inputRef.current[username].push(newStep);
    draw();

    const payload: WsMessage = {
      user: username,
      step: newStep,
    };
    wsRef.current?.send(JSON.stringify(payload));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const lastStep =
      inputRef.current[username][inputRef.current[username].length - 1];
    lastStep.coords.push(x, y);

    const payload: WsMessage = {
      user: username,
      step: {
        id: lastStep.id,
        coords: [x, y],
        color: lastStep.color,
      },
    };
    wsRef.current?.send(JSON.stringify(payload));

    draw();
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseLeave = () => {
    setIsDrawing(false);
  };

  useEffect(() => {
    const fn = async () => {
      const data = await (
        await fetch("http://localhost:3001/canvas/messages")
      ).json();
      console.log(data);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const data: WsMessage = JSON.parse(ev.data);

          if (username === data.user || data.step == null) return;

          if (!inputRef.current[data.user]) {
            inputRef.current[data.user] = [];
          }

          const lastStep =
            inputRef.current[data.user][inputRef.current[data.user].length - 1];

          if (lastStep?.id != null && data.step.id === lastStep.id) {
            lastStep.coords.push(data.step.coords[0], data.step.coords[1]);
          } else {
            inputRef.current[data.user].push(data.step);
          }

          draw();
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
      };
    };

    fn();

    return () => {
      wsRef.current?.close();
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

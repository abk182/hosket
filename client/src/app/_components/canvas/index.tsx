"use client";

import { getUrl } from "@/app/_utils/url";

import { useEffect, useRef, useState } from "react";
import { getRandomHexColor } from "./hex";

type Step = {
  user: string;
  id: number;
  coords: Array<number>;
  color: string;
};

export default function Canvas({ user }: { user: string }) {
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stepsRef = useRef<Array<Step>>([]);
  const drawingRef = useRef<boolean>(false);

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

    console.log(stepsRef.current);

    stepsRef.current.forEach((step) => {
      drawStep(step);
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    let id = stepsRef.current[stepsRef.current.length - 1]?.id;

    if (id == null) {
      id = 0;
    } else {
      id += 1;
    }

    const newStep = {
      user,
      id,
      color: getRandomHexColor(),
      coords: [x, y],
    };

    stepsRef.current.push(newStep);

    wsRef.current?.send(JSON.stringify(newStep));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const lastStep = stepsRef.current[stepsRef.current.length - 1];
    lastStep.coords.push(x, y);
    wsRef.current?.send(
      JSON.stringify({
        ...lastStep,
        coords: [x, y],
      })
    );

    draw();
  };

  const handleMouseUp = () => {
    drawingRef.current = false;
  };

  const handleMouseLeave = () => {
    drawingRef.current = false;
  };

  useEffect(() => {
    const fn = async () => {
      const data = await (
        await fetch(getUrl('canvas/messages', 'http'))
      ).json();
      stepsRef.current = data;
      draw();

      const ws = new WebSocket( getUrl("ws/canvas", 'ws'));
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        try {
          const data: Step = JSON.parse(ev.data);

          const currentStep = stepsRef.current.find(
            (step) => step.id === data.id
          );

          if (currentStep) {
            currentStep.coords.push(data.coords[0], data.coords[1]);
          } else {
            stepsRef.current.push(data);
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
  }, []);

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

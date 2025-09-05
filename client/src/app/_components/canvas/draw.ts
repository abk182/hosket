import { throttle } from "lodash";

let draw = (
  canvas: HTMLCanvasElement | null,
  input: { [key: string]: { x?: number; y?: number } }
) => {
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
};

draw = throttle(draw, 10);

export default draw;

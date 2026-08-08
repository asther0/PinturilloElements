"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Stroke } from "@/lib/types";

const MIN_POINT_DISTANCE = 2.5;
const MAX_POINTS_PER_STROKE = 72;

function compactStrokePoints(
  points: { x: number; y: number }[],
  maxPoints: number
): { x: number; y: number }[] {
  if (points.length <= maxPoints) return points;
  const result: { x: number; y: number }[] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    result.push(points[idx]);
  }
  result.push(points[points.length - 1]);
  return result;
}

export default function GameCanvas({
  strokes,
  isDrawing,
  onStroke,
}: {
  strokes: Stroke[];
  isDrawing: boolean;
  onStroke: (stroke: Stroke) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawingActive, setIsDrawingActive] = useState(false);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState(6);

  const getPos = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;
      if ("touches" in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    []
  );

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    const snapshot = canvas.width > 0 && canvas.height > 0
      ? canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height)
      : null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (snapshot) {
      ctx.putImageData(snapshot, 0, 0);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  // Redraw all strokes when they change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      drawStrokeToCtx(ctx, stroke);
    }
  }, [strokes]);

  function drawStrokeToCtx(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    if (stroke.tool === "eraser") {
      ctx.strokeStyle = "#ffffff";
    } else {
      ctx.strokeStyle = stroke.color;
    }
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  const startStroke = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      setIsDrawingActive(true);
      const pos = getPos(e);
      currentStrokeRef.current = {
        points: [pos],
        color,
        width,
        tool,
      };
    },
    [isDrawing, getPos, color, width, tool]
  );

  const moveStroke = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDrawingActive || !isDrawing || !currentStrokeRef.current) return;
      e.preventDefault();
      const pos = getPos(e);
      const points = currentStrokeRef.current.points;
      const previous = points[points.length - 1];
      const distance = Math.hypot(pos.x - previous.x, pos.y - previous.y);

      // Pointer events can produce thousands of near-identical points. Keep
      // each Portal stroke safely under the 2 KB persistent-content limit.
      if (distance < MIN_POINT_DISTANCE) return;
      points.push(pos);
      if (points.length > MAX_POINTS_PER_STROKE) {
        currentStrokeRef.current.points = compactStrokePoints(
          currentStrokeRef.current.points,
          MAX_POINTS_PER_STROKE
        );
      }
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const pts = currentStrokeRef.current.points;
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      if (tool === "eraser") {
        ctx.strokeStyle = "#ffffff";
      } else {
        ctx.strokeStyle = color;
      }
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    },
    [isDrawingActive, isDrawing, getPos, tool, color, width]
  );

  const endStroke = useCallback(() => {
    if (!isDrawingActive || !currentStrokeRef.current) return;
    setIsDrawingActive(false);
    const stroke = currentStrokeRef.current;
    if (stroke.points.length > 1) {
      onStroke(stroke);
    }
    currentStrokeRef.current = null;
  }, [isDrawingActive, onStroke]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => startStroke(e);
    const onMouseMove = (e: MouseEvent) => moveStroke(e);
    const onMouseUp = () => endStroke();
    const onTouchStart = (e: TouchEvent) => startStroke(e);
    const onTouchMove = (e: TouchEvent) => moveStroke(e);
    const onTouchEnd = () => endStroke();

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [startStroke, moveStroke, endStroke]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className={`h-full w-full ${isDrawing ? "cursor-crosshair" : "cursor-default"}`}
      />
      {isDrawing && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-black/70 px-4 py-2 backdrop-blur">
          <button
            onClick={() => setTool("pen")}
            className={`flex items-center justify-center rounded-lg p-2 ${tool === "pen" ? "bg-white/25" : ""}`}
            title="Lápiz"
            aria-label="Lápiz"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`flex items-center justify-center rounded-lg p-2 ${tool === "eraser" ? "bg-white/25" : ""}`}
            title="Borrador"
            aria-label="Borrador"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
              <path d="M22 21H7" />
              <path d="m5 11 9 9" />
            </svg>
          </button>
          <div className="mx-1 h-6 w-px bg-white/20" />
          <div className="flex gap-1">
            {["#000000", "#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#ffffff"].map((c) => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool("pen"); }}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-white" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="mx-1 h-6 w-px bg-white/20" />
          <div className="flex gap-1">
            {[2, 6, 12].map((wVal) => (
              <button
                key={wVal}
                onClick={() => setWidth(wVal)}
                className={`rounded-md px-2 py-1 text-xs font-semibold ${width === wVal ? "bg-white/45 text-black" : "bg-white/15 text-white"}`}
              >
                {wVal === 2 ? "F" : wVal === 6 ? "M" : "G"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

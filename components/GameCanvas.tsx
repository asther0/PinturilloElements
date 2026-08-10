"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Stroke } from "@/lib/types";

const MIN_POINT_DISTANCE = 2.5;

const STROKE_WIDTHS = [
  { value: 2, label: "Fino" },
  { value: 6, label: "Medio" },
  { value: 12, label: "Grueso" },
] as const;

const COLOR_SWATCHES = [
  "#000000",
  "#ffffff",
  "#e74c3c",
  "#e67e22",
  "#f1c40f",
  "#2ecc71",
  "#3498db",
  "#9b59b6",
] as const;

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-95 ${
        disabled
          ? "cursor-not-allowed text-white/30"
          : active
            ? "bg-white/25 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <span
      aria-hidden="true"
      className="mx-1 hidden h-6 w-px self-center bg-white/20 sm:block"
    />
  );
}

export default function GameCanvas({
  strokes,
  isDrawing,
  onStroke,
  onUndo,
  onClear,
}: {
  strokes: Stroke[];
  isDrawing: boolean;
  onStroke: (stroke: Stroke) => void;
  onUndo: () => void;
  onClear: () => void;
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
      return {
        x: Math.round(clientX - rect.left),
        y: Math.round(clientY - rect.top),
      };
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

      // Ignore densely sampled positions while retaining every accepted point.
      if (distance < MIN_POINT_DISTANCE) return;
      points.push(pos);
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

  const selectColor = useCallback((nextColor: string) => {
    setColor(nextColor);
    setTool("pen");
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className={`h-full w-full touch-none ${isDrawing ? "cursor-crosshair" : "cursor-default"}`}
      />
      {isDrawing && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center px-3">
          <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 border-2 border-[#111111] bg-[#111111] px-2.5 py-2 shadow-[5px_5px_0_#111111] sm:gap-2 sm:px-4">
            <div className="flex items-center gap-1">
              <ToolbarButton
                active={tool === "pen"}
                onClick={() => setTool("pen")}
                label="Lapiz"
                title="Lapiz"
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
              </ToolbarButton>
              <ToolbarButton
                active={tool === "eraser"}
                onClick={() => setTool("eraser")}
                label="Borrador"
                title="Borrador"
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
              </ToolbarButton>
            </div>

            <ToolbarDivider />

            <div className="flex items-center gap-1">
              <ToolbarButton
                onClick={onUndo}
                label="Deshacer"
                title="Deshacer"
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
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                </svg>
              </ToolbarButton>
              <ToolbarButton
                onClick={onClear}
                label="Borrar lienzo"
                title="Borrar lienzo"
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
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </ToolbarButton>
            </div>

            <ToolbarDivider />

            <div className="flex items-center gap-1">
              {STROKE_WIDTHS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  onClick={() => setWidth(entry.value)}
                  title={entry.label}
                  aria-label={`Grosor ${entry.label.toLowerCase()}`}
                  aria-pressed={width === entry.value}
                  className={`flex h-9 w-10 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-95 ${
                    width === entry.value
                      ? "bg-white/25"
                      : "hover:bg-white/10"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="block w-5 rounded-full bg-white"
                    style={{ height: entry.value }}
                  />
                </button>
              ))}
            </div>

            <ToolbarDivider />

            <div className="flex items-center gap-1">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => selectColor(swatch)}
                  title={swatch}
                  aria-label={`Color ${swatch}`}
                  aria-pressed={color === swatch}
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 active:scale-95 ${
                    color === swatch ? "ring-2 ring-white" : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="block h-6 w-6 rounded-full border-2 border-white/25"
                    style={{ backgroundColor: swatch }}
                  />
                </button>
              ))}
            </div>

            <ToolbarDivider />

            <label
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition hover:bg-white/10 focus-within:outline-none focus-within:ring-2 focus-within:ring-white/60"
              title="Elegir color"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none block h-6 w-6 rounded-full border-2 border-white/40"
                style={{ backgroundColor: color }}
              />
              <input
                type="color"
                value={color}
                onChange={(event) => selectColor(event.target.value)}
                aria-label="Elegir color con selector nativo"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

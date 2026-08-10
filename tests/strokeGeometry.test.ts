import { describe, expect, test } from "bun:test";
import { chunkStrokeForPortal, removeLogicalStroke } from "../lib/strokeGeometry";
import type { Stroke } from "../lib/types";

function sampledSemicircle(pointCount: number): Stroke {
  return {
    points: Array.from({ length: pointCount }, (_, index) => {
      const angle = (Math.PI * index) / (pointCount - 1);
      return { x: Math.round(Math.cos(angle) * 8_000), y: Math.round(Math.sin(angle) * 8_000) };
    }),
    color: "#3498db",
    width: 6,
    tool: "pen",
  };
}

function rejoin(chunks: Stroke[]): Stroke["points"] {
  return chunks.flatMap((chunk, index) => index === 0 ? chunk.points : chunk.points.slice(1));
}

describe("stroke geometry", () => {
  test("preserves every accepted curve point across ordered chunks", () => {
    const stroke = sampledSemicircle(1_000);
    const chunks = chunkStrokeForPortal(stroke, "drawer-1", "logical-stroke-1");

    expect(chunks.length).toBeGreaterThan(1);
    expect(rejoin(chunks)).toEqual(stroke.points);
    expect(chunks.every((chunk) => chunk.logicalStrokeId === "logical-stroke-1")).toBe(true);
    for (let index = 1; index < chunks.length; index++) {
      expect(chunks[index].points[0]).toEqual(chunks[index - 1].points.at(-1));
    }
  });

  test("removes every segment belonging to the last logical stroke", () => {
    const first = chunkStrokeForPortal(sampledSemicircle(250), "drawer-1", "first");
    const second = chunkStrokeForPortal(sampledSemicircle(1_000), "drawer-1", "second");

    expect(removeLogicalStroke([...first, ...second])).toEqual(first);
  });
});

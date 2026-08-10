import type { PortalEvent, Stroke } from "./types";

// Portal customer content is limited to 2 KiB. Reserve room for Portal's
// envelope and the event id added by the local dispatch layer.
export const PORTAL_SDK_MESSAGE_BYTE_LIMIT = 2 * 1024;
export const PORTAL_MESSAGE_BYTE_BUDGET = 1800;
const PORTAL_EVENT_ID_BYTE_RESERVE = 64;

const textEncoder = new TextEncoder();

export function portalEventByteLength(event: PortalEvent): number {
  return textEncoder.encode(JSON.stringify(event)).byteLength;
}

export function isPortalEventWithinBudget(event: PortalEvent): boolean {
  return portalEventByteLength(event) < PORTAL_MESSAGE_BYTE_BUDGET;
}

/** Validates an event before PortalDispatch adds its UUID. */
export function isPortalEventWithinBudgetAfterDispatch(event: PortalEvent): boolean {
  return portalEventByteLength(event) + PORTAL_EVENT_ID_BYTE_RESERVE < PORTAL_MESSAGE_BYTE_BUDGET;
}

/**
 * Splits a completed logical stroke into Portal-safe segments. Adjacent
 * segments share one endpoint, so rendering each segment preserves continuity
 * without changing any accepted input point.
 */
export function chunkStrokeForPortal(
  stroke: Stroke,
  playerId: string,
  logicalStrokeId: string
): Stroke[] {
  if (stroke.points.length === 0) return [];

  const chunks: Stroke[] = [];
  let start = 0;

  while (start < stroke.points.length) {
    let end = start;
    let chunk = createChunk(stroke, start, end, logicalStrokeId);

    if (!isPortalEventWithinBudgetAfterDispatch({ type: "stroke", payload: { playerId, stroke: chunk } })) {
      throw new RangeError("A Portal stroke point exceeds the message budget");
    }

    while (end + 1 < stroke.points.length) {
      const next = createChunk(stroke, start, end + 1, logicalStrokeId);
      if (!isPortalEventWithinBudgetAfterDispatch({ type: "stroke", payload: { playerId, stroke: next } })) break;
      end += 1;
      chunk = next;
    }

    // A multi-point stroke must keep an overlapping endpoint with its next
    // chunk. If even two points cannot fit, it cannot be transmitted intact.
    if (end === start && end + 1 < stroke.points.length) {
      throw new RangeError("Two Portal stroke points exceed the message budget");
    }

    chunks.push(chunk);
    if (end === stroke.points.length - 1) break;
    start = end;
  }

  return chunks;
}

export function removeLogicalStroke(strokes: Stroke[], logicalStrokeId?: string): Stroke[] {
  const targetId = logicalStrokeId ?? strokes.at(-1)?.logicalStrokeId;
  if (!targetId) return strokes.slice(0, -1);
  return strokes.filter((stroke) => stroke.logicalStrokeId !== targetId);
}

function createChunk(stroke: Stroke, start: number, end: number, logicalStrokeId: string): Stroke {
  return {
    ...stroke,
    logicalStrokeId,
    points: stroke.points.slice(start, end + 1),
  };
}

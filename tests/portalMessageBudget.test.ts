import { describe, expect, test } from "bun:test";
import {
  chunkStrokeForPortal,
  isPortalEventWithinBudget,
  isPortalEventWithinBudgetAfterDispatch,
  portalEventByteLength,
  PORTAL_MESSAGE_BYTE_BUDGET,
  PORTAL_SDK_MESSAGE_BYTE_LIMIT,
} from "../lib/strokeGeometry";
import type { PortalEvent, Stroke } from "../lib/types";

function sampledCurve(pointCount: number): Stroke {
  return {
    points: Array.from({ length: pointCount }, (_, index) => ({
      x: Math.round(Math.cos(index / 9) * 8_000),
      y: Math.round(Math.sin(index / 9) * 8_000),
    })),
    color: "#3498db",
    width: 6,
    tool: "pen",
  };
}

describe("Portal message budget", () => {
  test("serializes every stroke segment below the conservative app budget", () => {
    const chunks = chunkStrokeForPortal(sampledCurve(1_000), "drawer-1", "logical-stroke-1");

    for (const stroke of chunks) {
      const event: PortalEvent = {
        type: "stroke",
        eventId: "550e8400-e29b-41d4-a716-446655440000",
        payload: { playerId: "drawer-1", stroke },
      };
      expect(portalEventByteLength(event)).toBeLessThan(PORTAL_MESSAGE_BYTE_BUDGET);
      expect(portalEventByteLength(event)).toBeLessThan(PORTAL_SDK_MESSAGE_BYTE_LIMIT);
      expect(isPortalEventWithinBudget(event)).toBe(true);
    }
  });

  test("rejects an oversized non-stroke event", () => {
    const event: PortalEvent = {
      type: "guess",
      payload: { playerId: "guesser-1", content: "x".repeat(PORTAL_MESSAGE_BYTE_BUDGET) },
    };

    expect(portalEventByteLength(event)).toBeGreaterThanOrEqual(PORTAL_MESSAGE_BYTE_BUDGET);
    expect(isPortalEventWithinBudget(event)).toBe(false);
  });

  test("rejects reserve-gap outbound events before dispatch while accepting normalized events", () => {
    const event: PortalEvent = {
      type: "guess",
      payload: { playerId: "guesser-1", content: "x".repeat(PORTAL_MESSAGE_BYTE_BUDGET - 120) },
    };

    expect(isPortalEventWithinBudget(event)).toBe(true);
    expect(isPortalEventWithinBudgetAfterDispatch(event)).toBe(false);

    const normalizedEvent: PortalEvent = {
      ...event,
      eventId: "550e8400-e29b-41d4-a716-446655440000",
    };
    expect(isPortalEventWithinBudget(normalizedEvent)).toBe(true);
  });
});

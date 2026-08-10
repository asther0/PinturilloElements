import { describe, expect, test } from "bun:test";
import { createPortalDispatch } from "../lib/portalDispatch";
import type { PortalEvent } from "../lib/types";

describe("portal dispatch", () => {
  test("delivers locally before publishing one normalized event and ignores its echo", () => {
    const order: string[] = [];
    const locallyDelivered: PortalEvent[] = [];
    const remotelyPublished: PortalEvent[] = [];
    const dispatch = createPortalDispatch({
      createEventId: () => "start-123",
      deliverLocal: (event) => {
        order.push("local");
        locallyDelivered.push(event);
      },
      publishRemote: (event) => {
        order.push("remote");
        remotelyPublished.push(event);
      },
    });
    const start: PortalEvent = { type: "gameStart", payload: { players: [], totalRounds: 3 } };

    const normalized = dispatch.dispatch(start);

    expect(order).toEqual(["local", "remote"]);
    expect(locallyDelivered).toHaveLength(1);
    expect(remotelyPublished).toHaveLength(1);
    expect(normalized.eventId).toBe("start-123");
    expect(locallyDelivered[0].eventId).toBe(remotelyPublished[0].eventId);
    expect(dispatch.receive(remotelyPublished[0])).toBe(false);
    expect(locallyDelivered).toHaveLength(1);
  });

  test("delivers locally when the remote publisher is a fallback no-op", () => {
    const locallyDelivered: PortalEvent[] = [];
    const dispatch = createPortalDispatch({
      createEventId: () => "fallback-123",
      deliverLocal: (event) => locallyDelivered.push(event),
      publishRemote: () => {},
    });

    dispatch.dispatch({ type: "gameStart", payload: { players: [], totalRounds: 3 } });

    expect(locallyDelivered).toEqual([
      {
        type: "gameStart",
        payload: { players: [], totalRounds: 3 },
        eventId: "fallback-123",
      },
    ]);
  });
});

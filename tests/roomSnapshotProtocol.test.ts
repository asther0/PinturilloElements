import { describe, expect, test } from "bun:test";
import {
  buildRoomSnapshot,
  isSnapshotDirectedTo,
  applyRoomSnapshot,
} from "../lib/roomSnapshotProtocol";
import type { GameState } from "../lib/types";

function hostState(): GameState {
  return {
    roomId: "abc",
    phase: "lobby",
    players: [
      { id: "host-1", name: "Alba", score: 0, kind: "human" },
      { id: "guest-2", name: "Beto", score: 10, kind: "human" },
      { id: "room-agent-0", name: "Bot 1", score: 5, kind: "room-agent" },
    ],
    currentRound: 1,
    totalRounds: 3,
    currentDrawerIndex: 0,
    wordsForRound: ["vercel", "supabase", "obsidian"],
    scores: { "host-1": 0, "guest-2": 10, "room-agent-0": 5 },
    hostId: "host-1",
    roomConfig: {
      mode: "mixed",
      humanCapacity: 2,
      agentCount: 1,
      difficulty: "medium",
      totalRounds: 3,
      drawTimeSeconds: 60,
      lateJoinPolicy: "spectator",
      logoCollections: ["companies"],
    },
  };
}

function hostDrawingState(): GameState {
  const state = hostState();
  return {
    ...state,
    phase: "drawing",
    roundState: {
      roundNumber: 1,
      drawerId: "host-1",
      word: "vercel",
      strokes: [],
      guesses: [],
      timeRemaining: 42,
      startedAt: 12345,
    },
  };
}

// A spectator/guest that joined after the lobby broadcast: empty roster, no
// cached host, and a roomConfig from its own join URL (which can differ from
// the host's authoritative config).
function emptyGuestState(): GameState {
  return {
    roomId: "abc",
    phase: "lobby",
    players: [],
    currentRound: 1,
    totalRounds: 3,
    currentDrawerIndex: 0,
    wordsForRound: [],
    scores: {},
    hostId: "",
    roomConfig: {
      mode: "mixed",
      humanCapacity: 6,
      agentCount: 0,
      totalRounds: 3,
      drawTimeSeconds: 60,
      lateJoinPolicy: "spectator",
      logoCollections: [],
    },
  };
}

describe("roomSnapshotProtocol", () => {
  test("host builds a snapshot without the secret round word or word choices", () => {
    const state = hostDrawingState();
    const snapshot = buildRoomSnapshot(
      state,
      { requestId: "req-1", targetPlayerId: "guest-2" },
      state.hostId || "host-1"
    );

    expect(snapshot.requestId).toBe("req-1");
    expect(snapshot.targetPlayerId).toBe("guest-2");
    expect(snapshot.hostId).toBe("host-1");
    expect(snapshot.roundState?.word).toBeUndefined();
    expect(snapshot.wordsForRound).toBeUndefined();

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain("vercel");
    expect(serialized).not.toContain("supabase");
    expect(serialized).not.toContain("obsidian");
  });

  test("guest applies only a snapshot directed to its own request", () => {
    const snapshot = buildRoomSnapshot(
      hostState(),
      { requestId: "req-1", targetPlayerId: "guest-2" },
      "host-1"
    );

    expect(isSnapshotDirectedTo(snapshot, "req-1", "guest-2")).toBe(true);
    // Same request but different player: the broadcast was aimed at someone else.
    expect(isSnapshotDirectedTo(snapshot, "req-1", "guest-3")).toBe(false);
    // Same player but a different (stale) request id.
    expect(isSnapshotDirectedTo(snapshot, "req-2", "guest-2")).toBe(false);
  });

  test("a guest with an empty roster hydrates from a matching snapshot (regression: host 1/2 vs guest 0/6, no roster)", () => {
    const host = hostState();
    const snapshot = buildRoomSnapshot(
      host,
      { requestId: "req-1", targetPlayerId: "guest-2" },
      host.hostId || "host-1"
    );

    const hydrated = applyRoomSnapshot(emptyGuestState(), snapshot);

    expect(hydrated.players).toEqual(host.players);
    expect(hydrated.hostId).toBe("host-1");
    expect(hydrated.scores).toEqual(host.scores);
    expect(hydrated.roomConfig).toEqual(host.roomConfig);
  });

  test("applying a snapshot never resurrects the secret word", () => {
    const state = hostDrawingState();
    const snapshot = buildRoomSnapshot(
      state,
      { requestId: "req-1", targetPlayerId: "guest-2" },
      "host-1"
    );

    const hydrated = applyRoomSnapshot(emptyGuestState(), snapshot);

    expect(hydrated.roundState?.word).toBe("");
    expect(hydrated.wordsForRound).toEqual([]);
    expect(JSON.stringify(hydrated)).not.toContain("vercel");
  });
});
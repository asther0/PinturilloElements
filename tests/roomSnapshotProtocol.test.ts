import { describe, expect, test } from "bun:test";
import {
  buildRoomSnapshot,
  acceptLobbyJoin,
  ensureJoinRequestId,
  isSnapshotDirectedTo,
  applyRoomSnapshot,
  selectSnapshotRequester,
  createJoinRetryState,
  createSnapshotRetryState,
  shouldRetryJoinRequest,
  shouldRetrySnapshotRequest,
  SNAPSHOT_RETRY_MAX_ATTEMPTS,
  SNAPSHOT_RETRY_INTERVAL_MS,
} from "../lib/roomSnapshotProtocol";
import type { GameState } from "../lib/types";

function hostState(): GameState {
  return {
    roomId: "abc",
    phase: "lobby",
    players: [
      { id: "host-1", name: "Alba", score: 0, kind: "human" },
      { id: "guest-2", name: "Beto", score: 10, kind: "human" },
    ],
    currentRound: 1,
    totalRounds: 3,
    currentDrawerIndex: 0,
    wordsForRound: ["vercel", "supabase", "obsidian"],
    scores: { "host-1": 0, "guest-2": 10 },
    hostId: "host-1",
    roomConfig: {
      humanCount: 2,
      roundCount: 3,
      drawTimeSeconds: 60,
      lateJoin: "spectator",
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
      humanCount: 6,
      roundCount: 3,
      drawTimeSeconds: 60,
      lateJoin: "spectator",
      logoCollections: [],
    },
  };
}

describe("roomSnapshotProtocol", () => {
  test("a delayed join acceptance still matches after multiple retries", () => {
    let generated = 0;
    const generate = () => `join-${++generated}`;
    let requestId: string | null = null;

    // Retries resend the same id, so an acceptance delayed from the first
    // delivery is still directed at the guest's active join attempt.
    requestId = ensureJoinRequestId(requestId, generate);
    requestId = ensureJoinRequestId(requestId, generate);
    requestId = ensureJoinRequestId(requestId, generate);

    const delayedAcceptance = buildRoomSnapshot(
      hostState(),
      { requestId: "join-1", targetPlayerId: "guest-2" },
      "host-1"
    );
    expect(generated).toBe(1);
    expect(isSnapshotDirectedTo(delayedAcceptance, requestId, "guest-2")).toBe(true);
  });

  test("join acceptance is idempotent and snapshots the computed roster despite duplicate or reordered delivery", () => {
    const host = {
      ...hostState(),
      players: [hostState().players[0]],
      scores: { "host-1": 0 },
    };
    const alba = { id: "guest-2", name: "Beto", score: 0, kind: "human" as const };

    // The guest's retry arrives before its original request. Each host result
    // becomes the state for the next delivery, modeling the React render state
    // that would otherwise be stale while Portal reorders deliveries.
    const first = acceptLobbyJoin(host, { requestId: "join-alba-retry", targetPlayerId: alba.id, player: alba }, "host-1");
    expect(first.type).toBe("joinAccepted");
    if (first.type !== "joinAccepted") throw new Error("expected acceptance");
    expect(first.payload.players.map((player) => player.id)).toEqual(["host-1", "guest-2"]);

    const duplicate = acceptLobbyJoin(first.nextState, { requestId: "join-alba-original", targetPlayerId: alba.id, player: alba }, "host-1");
    expect(duplicate.type).toBe("joinAccepted");
    if (duplicate.type !== "joinAccepted") throw new Error("expected acceptance");
    expect(duplicate.nextState.players.map((player) => player.id)).toEqual(["host-1", "guest-2"]);
    expect(duplicate.payload.players).toEqual(duplicate.nextState.players);
    expect(duplicate.payload.targetPlayerId).toBe(alba.id);
    expect(duplicate.payload.requestId).toBe("join-alba-original");
  });

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

  test("selectSnapshotRequester validates identity and rejects malformed input", () => {
    expect(selectSnapshotRequester({})).toBeNull();
    expect(selectSnapshotRequester({ requesterId: "", requestId: "r1" })).toBeNull();
    expect(selectSnapshotRequester({ requesterId: "guest-2", requestId: "" })).toBeNull();
    expect(selectSnapshotRequester({ requesterId: 123, requestId: "r1" })).toBeNull();
    expect(selectSnapshotRequester({ requesterId: "guest-2", requestId: "r1" })).toEqual({
      requestId: "r1",
      requesterId: "guest-2",
    });
  });

  test("join retry is bounded by max attempts and stops once in roster", () => {
    const state = createJoinRetryState({ maxAttempts: 3, intervalMs: 2000 });
    const now = 10000;

    // First attempt allowed
    expect(shouldRetryJoinRequest(state, now, { hasRosterEntry: false })).toBe(true);
    state.attempts = 1;
    state.lastAttemptAt = now;

    // Too soon
    expect(shouldRetryJoinRequest(state, now + 1000, { hasRosterEntry: false })).toBe(false);

    // After interval, second attempt
    expect(shouldRetryJoinRequest(state, now + 2000, { hasRosterEntry: false })).toBe(true);
    state.attempts = 2;
    state.lastAttemptAt = now + 2000;

    // Third attempt
    expect(shouldRetryJoinRequest(state, now + 4000, { hasRosterEntry: false })).toBe(true);
    state.attempts = 3;
    state.lastAttemptAt = now + 4000;

    // Max attempts reached
    expect(shouldRetryJoinRequest(state, now + 6000, { hasRosterEntry: false })).toBe(false);

    // Even before max attempts, roster entry stops retries
    const fresh = createJoinRetryState({ maxAttempts: 3, intervalMs: 2000 });
    expect(shouldRetryJoinRequest(fresh, now, { hasRosterEntry: true })).toBe(false);
  });

  test("snapshot retry is bounded and requires both acknowledgement and roster", () => {
    const state = createSnapshotRetryState({ maxAttempts: 3, intervalMs: 2000 });
    const now = 10000;

    // No request sent yet: not acknowledged
    expect(
      shouldRetrySnapshotRequest(state, now, {
        lastRequestId: null,
        lastResponseId: null,
        hasRosterEntry: false,
      })
    ).toBe(true);
    state.attempts = 1;
    state.lastAttemptAt = now;

    // Acknowledged but no roster: still retry
    expect(
      shouldRetrySnapshotRequest(state, now + 2000, {
        lastRequestId: "r1",
        lastResponseId: "r1",
        hasRosterEntry: false,
      })
    ).toBe(true);
    state.attempts = 2;
    state.lastAttemptAt = now + 2000;

    // Roster present but not acknowledged: still retry
    expect(
      shouldRetrySnapshotRequest(state, now + 4000, {
        lastRequestId: "r1",
        lastResponseId: "r2",
        hasRosterEntry: true,
      })
    ).toBe(true);
    state.attempts = 3;
    state.lastAttemptAt = now + 4000;

    // Max attempts reached
    expect(
      shouldRetrySnapshotRequest(state, now + 6000, {
        lastRequestId: "r1",
        lastResponseId: "r2",
        hasRosterEntry: true,
      })
    ).toBe(false);

    // Both acknowledged and in roster: stop even before max attempts
    const fresh = createSnapshotRetryState({ maxAttempts: 3, intervalMs: 2000 });
    expect(
      shouldRetrySnapshotRequest(fresh, now, {
        lastRequestId: "r1",
        lastResponseId: "r1",
        hasRosterEntry: true,
      })
    ).toBe(false);
  });

  test("reconnect reset helpers produce zeroed retry state", () => {
    const join = createJoinRetryState();
    expect(join.attempts).toBe(0);
    expect(join.lastAttemptAt).toBe(0);
    expect(join.maxAttempts).toBe(SNAPSHOT_RETRY_MAX_ATTEMPTS);
    expect(join.intervalMs).toBe(SNAPSHOT_RETRY_INTERVAL_MS);

    const snapshot = createSnapshotRetryState({ maxAttempts: 7, intervalMs: 5000 });
    expect(snapshot.attempts).toBe(0);
    expect(snapshot.lastAttemptAt).toBe(0);
    expect(snapshot.maxAttempts).toBe(7);
    expect(snapshot.intervalMs).toBe(5000);
  });
});

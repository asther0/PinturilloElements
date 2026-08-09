import type { GameState, Player, RoomSnapshotPayload } from "./types";

// Snapshots must stay comfortably under the Portal 2KB send limit. When the
// payload exceeds this budget, heavy per-player optional fields are stripped.
export const SNAPSHOT_MAX_BYTES = 1800;

// Default guest retry parameters for playerJoin and roomSnapshotRequest. They
// are shared by the bounded retry loop in RoomPageClient and the unit tests
// that pin the timing semantics.
export const SNAPSHOT_RETRY_INTERVAL_MS = 2000;
export const SNAPSHOT_RETRY_MAX_ATTEMPTS = 5;

export interface SnapshotRequest {
  requestId: string;
  targetPlayerId: string;
}

function stringByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * Build a snapshot payload that a host sends to hydrate a specific requesting
 * player. The snapshot is safe to broadcast: it is correlated by requestId +
 * targetPlayerId and only the requesting player applies it, so it does not
 * depend on Portal persistent channel membership to reach its target.
 *
 * The secret round word and the word choices are deliberately excluded so a
 * late-joining spectator can never extract the current answer through the
 * sync protocol.
 */
export function buildRoomSnapshot(
  state: GameState,
  request: SnapshotRequest,
  hostId: string
): RoomSnapshotPayload {
  const roundState = state.roundState
    ? {
        roundNumber: state.roundState.roundNumber,
        drawerId: state.roundState.drawerId,
        timeRemaining: state.roundState.timeRemaining,
        startedAt: state.roundState.startedAt,
      }
    : undefined;

  const payload: RoomSnapshotPayload = {
    requestId: request.requestId,
    targetPlayerId: request.targetPlayerId,
    roomConfig: state.roomConfig,
    players: state.players,
    hostId,
    phase: state.phase,
    currentRound: state.currentRound,
    totalRounds: state.totalRounds,
    scores: state.scores,
    currentDrawerIndex: state.currentDrawerIndex,
    ...(roundState ? { roundState } : {}),
    ...(state.winnerId ? { winnerId: state.winnerId } : {}),
  };

  return trimOversizedAvatars(payload);
}

function trimOversizedAvatars(payload: RoomSnapshotPayload): RoomSnapshotPayload {
  const rawSize = stringByteLength(
    JSON.stringify({ type: "roomSnapshot", payload })
  );
  if (rawSize <= SNAPSHOT_MAX_BYTES) return payload;
  return {
    ...payload,
    players: payload.players.map((player: Player) => ({
      ...player,
      avatar: undefined,
    })),
  };
}

/**
 * Broadcast snapshots reach every connected client. A client applies one only
 * when it matches the request this client actually issued (requestId) and was
 * addressed to this client (targetPlayerId).
 */
export function isSnapshotDirectedTo(
  payload: RoomSnapshotPayload,
  requestId: string | null,
  localPlayerId: string
): boolean {
  return payload.requestId === requestId && payload.targetPlayerId === localPlayerId;
}

/**
 * Validate a roomSnapshotRequest and return the requesterId that the host
 * should use as the snapshot's `targetPlayerId`.
 *
 * Identity contract: the host must address the snapshot to the requesting
 * guest's *local* player id, not to Portal's anonymous `senderId`. Portal's
 * senderId is a per-message identity any connected client can forge, and it
 * does not correspond to any app-level player. The only value the guest
 * actually uses to filter incoming snapshots is its own `localPlayerId`, and
 * the only field that carries that value across Portal is `payload.requesterId`.
 *
 * Returns `null` when the request is malformed (missing/empty requestId or
 * requesterId, non-string values). Callers must treat `null` as "ignore this
 * request" and never synthesize a targetPlayerId from the senderId.
 */
export function selectSnapshotRequester(payload: {
  requesterId?: unknown;
  requestId?: unknown;
}): { requestId: string; requesterId: string } | null {
  const requestId =
    typeof payload?.requestId === "string" ? payload.requestId.trim() : "";
  const requesterId =
    typeof payload?.requesterId === "string" ? payload.requesterId.trim() : "";
  if (!requestId || !requesterId) return null;
  return { requestId, requesterId };
}

export interface RetryState {
  attempts: number;
  maxAttempts: number;
  intervalMs: number;
  lastAttemptAt: number;
}

export function createJoinRetryState(opts?: {
  maxAttempts?: number;
  intervalMs?: number;
}): RetryState {
  return {
    attempts: 0,
    maxAttempts: opts?.maxAttempts ?? SNAPSHOT_RETRY_MAX_ATTEMPTS,
    intervalMs: opts?.intervalMs ?? SNAPSHOT_RETRY_INTERVAL_MS,
    lastAttemptAt: 0,
  };
}

export function createSnapshotRetryState(opts?: {
  maxAttempts?: number;
  intervalMs?: number;
}): RetryState {
  return {
    attempts: 0,
    maxAttempts: opts?.maxAttempts ?? SNAPSHOT_RETRY_MAX_ATTEMPTS,
    intervalMs: opts?.intervalMs ?? SNAPSHOT_RETRY_INTERVAL_MS,
    lastAttemptAt: 0,
  };
}

/**
 * Pure decision: should the guest re-send `playerJoin` right now?
 *
 * The guest retries only while the host's authoritative roster has not yet
 * acknowledged the local player. Once the host has applied a snapshot that
 * contains the local player id, `hasRosterEntry` becomes true and the retry
 * stops. The loop is bounded by `maxAttempts` and respects a fixed interval
 * between attempts so the host is not flooded.
 */
export function shouldRetryJoinRequest(
  state: RetryState,
  now: number,
  ctx: { hasRosterEntry: boolean }
): boolean {
  if (state.attempts >= state.maxAttempts) return false;
  if (ctx.hasRosterEntry) return false;
  if (now - state.lastAttemptAt < state.intervalMs) return false;
  return true;
}

/**
 * Pure decision: should the guest re-send `roomSnapshotRequest` right now?
 *
 * The guest retries until BOTH (a) the last response id matches the last
 * request id (the host acknowledged the request by broadcasting a snapshot
 * back), AND (b) the local roster has been hydrated. The interval and
 * `maxAttempts` bounds mirror `shouldRetryJoinRequest`. Each retry must
 * update `lastRequestId` with a fresh value so stale responses from earlier
 * requests cannot satisfy a newer one.
 */
export function shouldRetrySnapshotRequest(
  state: RetryState,
  now: number,
  ctx: {
    lastRequestId: string | null;
    lastResponseId: string | null;
    hasRosterEntry: boolean;
  }
): boolean {
  if (state.attempts >= state.maxAttempts) return false;
  const acknowledged =
    ctx.lastRequestId != null && ctx.lastRequestId === ctx.lastResponseId;
  if (acknowledged && ctx.hasRosterEntry) return false;
  if (now - state.lastAttemptAt < state.intervalMs) return false;
  return true;
}

/**
 * Pure reducer for applying a matching snapshot onto local guest state. This
 * is what fixes the guest lobby that would otherwise show 0 humans / no
 * roster while the host shows the real roster.
 */
export function applyRoomSnapshot(
  state: GameState,
  payload: RoomSnapshotPayload
): GameState {
  if (state.hostId && state.hostId !== payload.hostId) return state;
  return {
    ...state,
    roomConfig: payload.roomConfig,
    players: payload.players,
    hostId: payload.hostId,
    phase: payload.phase,
    currentRound: payload.currentRound,
    totalRounds: payload.totalRounds,
    scores: payload.scores,
    currentDrawerIndex: payload.currentDrawerIndex,
    wordsForRound: [],
    roundState: payload.roundState
      ? {
          ...payload.roundState,
          word: payload.roundState.word ?? "",
          strokes: [],
          guesses: [],
        }
      : undefined,
    ...(payload.winnerId !== undefined ? { winnerId: payload.winnerId } : {}),
  };
}


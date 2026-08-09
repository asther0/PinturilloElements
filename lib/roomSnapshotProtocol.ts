import type { GameState, Player, RoomSnapshotPayload } from "./types";

// Snapshots must stay comfortably under the Portal 2KB send limit. When the
// payload exceeds this budget, heavy per-player optional fields are stripped.
export const SNAPSHOT_MAX_BYTES = 1800;

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


import { describe, expect, test } from "bun:test";
import { applyNextTurn, formatWordHint, returnToLobby } from "../lib/gameLogic";
import type { GameState } from "../lib/types";

function roundResultState(): GameState {
  return {
    roomId: "room-1",
    phase: "roundResult",
    players: [
      { id: "host", name: "Alba", score: 0, kind: "human" },
      { id: "guest", name: "Luiggi", score: 0, kind: "human" },
    ],
    currentRound: 1,
    totalRounds: 3,
    currentDrawerIndex: 0,
    wordsForRound: [],
    scores: { host: 0, guest: 0 },
    hostId: "host",
    roomConfig: {
      humanCount: 2,
      roundCount: 3,
      drawTimeSeconds: 60,
      lateJoin: "spectator",
      logoCollections: ["open"],
    },
  };
}

describe("next-turn state transition", () => {
  test("converges host and guest on Luiggi when the guest receives nextTurn before its timer", () => {
    const nextTurn = { drawerId: "guest", roundNumber: 1, words: ["aws-cognito", "instagram", "amp"] };
    const hostAfterTimeout = applyNextTurn(roundResultState(), nextTurn);
    const guestBeforeOwnTimeout = applyNextTurn(roundResultState(), nextTurn);

    expect(hostAfterTimeout).toEqual(guestBeforeOwnTimeout);
    expect(guestBeforeOwnTimeout.phase).toBe("choosing");
    expect(guestBeforeOwnTimeout.currentDrawerIndex).toBe(1);
    expect(guestBeforeOwnTimeout.players[guestBeforeOwnTimeout.currentDrawerIndex]?.name).toBe("Luiggi");
    expect(guestBeforeOwnTimeout.wordsForRound).toEqual(nextTurn.words);
  });

  test("rejects invalid, duplicate, and stale nextTurn events without regressing", () => {
    const state = roundResultState();
    const valid = { drawerId: "guest", roundNumber: 1, words: ["aws-cognito"] };
    const applied = applyNextTurn(state, valid);

    expect(applyNextTurn(state, { ...valid, drawerId: "host" })).toBe(state);
    expect(applyNextTurn(state, { ...valid, roundNumber: 2 })).toBe(state);
    expect(applyNextTurn(state, { ...valid, words: [] })).toBe(state);
    expect(applyNextTurn(applied, valid)).toBe(applied);
  });
});

describe("formatWordHint", () => {
  test("masks consonants while preserving vowels and separators", () => {
    expect(formatWordHint("aws-cognito")).toBe("a__-_o__i_o");
    expect(formatWordHint("Instagram Pro")).toBe("i___a__a_ __o");
  });
});

describe("return-to-lobby state transition", () => {
  test("preserves the room while only the host can reset an ended game", () => {
    const baseState = roundResultState();
    const roster = baseState.players;
    const roomConfig = baseState.roomConfig;
    const endedGame: GameState = {
      ...baseState,
      phase: "gameOver",
      currentRound: 3,
      currentDrawerIndex: 1,
      wordsForRound: ["aws-cognito", "instagram"],
      scores: { host: 175, guest: 225 },
      winnerId: "guest",
      roundState: {
        roundNumber: 3,
        drawerId: "guest",
        word: "instagram",
        strokes: [],
        guesses: [],
        timeRemaining: 0,
        startedAt: 123,
      },
    };

    expect(returnToLobby(endedGame, "guest")).toBe(endedGame);

    const lobby = returnToLobby(endedGame, "host");

    expect(lobby.phase).toBe("lobby");
    expect(lobby.currentRound).toBe(1);
    expect(lobby.currentDrawerIndex).toBe(0);
    expect(lobby.wordsForRound).toEqual([]);
    expect(lobby.scores).toEqual({ host: 0, guest: 0 });
    expect(lobby.winnerId).toBeUndefined();
    expect(lobby.roundState).toBeUndefined();
    expect(lobby.players).toBe(roster);
    expect(lobby.roomConfig).toBe(roomConfig);
    expect(lobby.hostId).toBe("host");
    expect(lobby.totalRounds).toBe(3);
  });
});

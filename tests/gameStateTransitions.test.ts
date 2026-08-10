import { describe, expect, test } from "bun:test";
import {
  applyNextTurn,
  formatWordHint,
  haveAllEligiblePlayersGuessed,
  recordFirstCorrectGuess,
  returnToLobby,
} from "../lib/gameLogic";
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

describe("correct guess completion", () => {
  test("finishes a two-player round when the only guesser answers correctly", () => {
    const result = recordFirstCorrectGuess({
      playerIds: ["drawer", "guesser"],
      drawerId: "drawer",
      guesserId: "guesser",
      scores: { drawer: 0, guesser: 0 },
      correctGuesserIds: new Set(),
      guessScore: 75,
    });

    expect(result.accepted).toBe(true);
    expect(haveAllEligiblePlayersGuessed(["drawer", "guesser"], "drawer", result.correctGuesserIds)).toBe(true);
    expect(result.scores).toEqual({ drawer: 25, guesser: 75 });
  });

  test("waits for each unique non-drawer guesser", () => {
    const first = recordFirstCorrectGuess({
      playerIds: ["drawer", "alba", "luis"],
      drawerId: "drawer",
      guesserId: "alba",
      scores: { drawer: 0, alba: 0, luis: 0 },
      correctGuesserIds: new Set(),
      guessScore: 80,
    });
    const last = recordFirstCorrectGuess({
      playerIds: ["drawer", "alba", "luis"],
      drawerId: "drawer",
      guesserId: "luis",
      scores: first.scores,
      correctGuesserIds: first.correctGuesserIds,
      guessScore: 70,
    });

    expect(haveAllEligiblePlayersGuessed(["drawer", "alba", "luis"], "drawer", first.correctGuesserIds)).toBe(false);
    expect(haveAllEligiblePlayersGuessed(["drawer", "alba", "luis"], "drawer", last.correctGuesserIds)).toBe(true);
    expect(last.scores).toEqual({ drawer: 50, alba: 80, luis: 70 });
  });

  test("ignores duplicate answers without scoring or completing again", () => {
    const first = recordFirstCorrectGuess({
      playerIds: ["drawer", "guesser"],
      drawerId: "drawer",
      guesserId: "guesser",
      scores: { drawer: 0, guesser: 0 },
      correctGuesserIds: new Set(),
      guessScore: 75,
    });
    const duplicate = recordFirstCorrectGuess({
      playerIds: ["drawer", "guesser"],
      drawerId: "drawer",
      guesserId: "guesser",
      scores: first.scores,
      correctGuesserIds: first.correctGuesserIds,
      guessScore: 75,
    });

    expect(duplicate.accepted).toBe(false);
    expect(
      duplicate.accepted &&
        haveAllEligiblePlayersGuessed(["drawer", "guesser"], "drawer", duplicate.correctGuesserIds)
    ).toBe(false);
    expect(duplicate.scores).toEqual(first.scores);
  });

  test("excludes the drawer from eligible correct guessers", () => {
    const result = recordFirstCorrectGuess({
      playerIds: ["drawer", "guesser"],
      drawerId: "drawer",
      guesserId: "drawer",
      scores: { drawer: 0, guesser: 0 },
      correctGuesserIds: new Set(),
      guessScore: 75,
    });

    expect(result.accepted).toBe(false);
    expect(haveAllEligiblePlayersGuessed(["drawer", "guesser"], "drawer", result.correctGuesserIds)).toBe(false);
    expect(result.scores).toEqual({ drawer: 0, guesser: 0 });
  });
});

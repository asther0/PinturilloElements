import { Player, GameState, ChatMessage, RoundState, PetdexAvatar, RoomConfig } from "./types";
import { LOGO_CATALOG, LOGO_COLLECTIONS } from "./logoCollections";
export { LOGO_COLLECTIONS } from "./logoCollections";

export const TECH_COMPANY_WORDS = [
  "Vercel",
  "Supabase",
  "Obsidian",
];

export const TOTAL_ROUNDS = 3;
export const DRAW_TIME_SECONDS = 60;
export const CHOOSE_WORD_TIME_SECONDS = 10;
export const ROUND_RESULT_SECONDS = 5;

/** A choice turn is actionable only after the host has supplied every card. */
export function shouldStartChoosingCountdown(wordsForRound: readonly string[]): boolean {
  return wordsForRound.length === 3;
}

export function makeHumanPlayer(id: string, name: string, avatar?: PetdexAvatar): Player {
  return { id, name, score: 0, kind: "human", avatar };
}

export function createInitialState(
  roomId: string,
  localPlayerId: string,
  localPlayerName: string,
  isHost: boolean,
  roomConfig: RoomConfig,
  localAvatar?: PetdexAvatar
): GameState {
  const players: Player[] = [];
  const localPlayer = makeHumanPlayer(localPlayerId, localPlayerName, localAvatar);
  players.push(localPlayer);

  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = 0;

  return {
    roomId,
    phase: "lobby",
    players,
    currentRound: 1,
    totalRounds: roomConfig.roundCount,
    currentDrawerIndex: 0,
    wordsForRound: [],
    scores,
    hostId: isHost ? localPlayerId : "",
    roomConfig,
  };
}

export function getCurrentDrawer(state: GameState): Player | undefined {
  return state.players[state.currentDrawerIndex];
}

export function isLocalPlayerDrawer(state: GameState, localPlayerId: string): boolean {
  const drawer = getCurrentDrawer(state);
  return drawer?.id === localPlayerId;
}

// Logo catalog and collections are imported from the generated snapshot.
// Run `bun run sync:logos` to refresh from the live TryElements registry.

export function wordsForCollections(collectionIds: string[]): string[] | null {
  const selected = new Set(
    collectionIds.filter((id) => LOGO_COLLECTIONS.some((c) => c.id === id))
  );
  if (selected.size === 0) return null;

  const mapped = new Set<string>();
  for (const collection of LOGO_COLLECTIONS) {
    if (selected.has(collection.id)) {
      for (const word of collection.words) mapped.add(word);
    }
  }
  if (mapped.size === 0) return null;

  return [...mapped];
}

export function pickThreeWords(
  collectionIds?: string[],
  exclude?: ReadonlySet<string>
): string[] {
  const candidates =
    collectionIds && collectionIds.length > 0
      ? wordsForCollections(collectionIds) ?? LOGO_CATALOG
      : LOGO_CATALOG;
  const available =
    exclude && exclude.size > 0
      ? candidates.filter((word) => !exclude.has(word))
      : candidates;
  const pool = available.length > 0 ? available : candidates;
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export function calculateGuessScore(
  timeRemaining: number,
  totalTime: number = DRAW_TIME_SECONDS
): number {
  const ratio = timeRemaining / totalTime;
  return Math.round(50 + ratio * 50);
}

export function checkGuess(guess: string, targetWord: string): boolean {
  return guess.toLowerCase().trim() === targetWord.toLowerCase().trim();
}

export function advanceDrawer(state: GameState): GameState {
  if (state.players.length === 0) return state;
  const nextIndex = (state.currentDrawerIndex + 1) % state.players.length;
  const nextRound = nextIndex === 0 ? state.currentRound + 1 : state.currentRound;
  return {
    ...state,
    currentDrawerIndex: nextIndex,
    currentRound: nextRound,
  };
}

export type NextTurnPayload = {
  drawerId: string;
  roundNumber: number;
  words: string[];
};

/**
 * Apply the host's ordered next-turn instruction. The payload is only valid
 * for the immediate successor of the completed turn, so duplicate, stale,
 * or reordered events leave local state untouched.
 */
export function applyNextTurn(state: GameState, payload: NextTurnPayload): GameState {
  if (state.phase !== "roundResult" || state.players.length === 0 || payload.words.length === 0) {
    return state;
  }

  const expected = advanceDrawer(state);
  const expectedDrawer = expected.players[expected.currentDrawerIndex];
  if (
    !expectedDrawer ||
    payload.drawerId !== expectedDrawer.id ||
    payload.roundNumber !== expected.currentRound
  ) {
    return state;
  }

  return {
    ...state,
    phase: "choosing",
    currentRound: expected.currentRound,
    currentDrawerIndex: expected.currentDrawerIndex,
    wordsForRound: [...payload.words],
  };
}

/**
 * Return an ended game to its existing lobby. The host id in the event must
 * match the established room host so a guest cannot initiate the transition.
 */
export function returnToLobby(state: GameState, hostId: string): GameState {
  if (state.phase !== "gameOver" || state.hostId !== hostId) return state;

  return {
    ...state,
    phase: "lobby",
    currentRound: 1,
    currentDrawerIndex: 0,
    wordsForRound: [],
    scores: Object.fromEntries(state.players.map((player) => [player.id, 0])),
    winnerId: undefined,
    roundState: undefined,
  };
}

export function shouldEndGame(state: GameState): boolean {
  const completedTurns =
    (state.currentRound - 1) * state.players.length +
    state.currentDrawerIndex +
    1;
  return completedTurns >= state.totalRounds * state.players.length;
}

export const DRAWER_GUESS_BONUS = 25;
export const DRAWER_NO_CORRECT_GUESSERS_PENALTY = 25;

/**
 * Produce the score payload for a completed round. The host calls this once
 * before broadcasting roundEnd; clients apply that payload without adjusting
 * scores locally.
 */
export function finalizeRoundScores(
  drawerId: string,
  scores: Record<string, number>,
  correctGuesserIds: ReadonlySet<string>
): Record<string, number> {
  if (correctGuesserIds.size > 0) return scores;

  return {
    ...scores,
    [drawerId]: (scores[drawerId] || 0) - DRAWER_NO_CORRECT_GUESSERS_PENALTY,
  };
}

export type CorrectGuessProgress = {
  playerIds: readonly string[];
  drawerId: string;
  guesserId: string;
  scores: Record<string, number>;
  correctGuesserIds: ReadonlySet<string>;
  guessScore: number;
};

/**
 * Accept exactly one correct answer per eligible guesser and report whether
 * it should be scored. The caller owns event authority; completion stays in a
 * separate pure helper so only the host needs to evaluate it.
 */
export function recordFirstCorrectGuess({
  playerIds,
  drawerId,
  guesserId,
  scores,
  correctGuesserIds,
  guessScore,
}: CorrectGuessProgress): {
  accepted: boolean;
  scores: Record<string, number>;
  correctGuesserIds: Set<string>;
} {
  const eligibleGuessers = playerIds.filter((playerId) => playerId !== drawerId);
  const accepted =
    eligibleGuessers.includes(guesserId) && !correctGuesserIds.has(guesserId);
  if (!accepted) {
    return {
      accepted: false,
      scores,
      correctGuesserIds: new Set(correctGuesserIds),
    };
  }

  const nextCorrectGuessers = new Set(correctGuesserIds).add(guesserId);
  const nextScores = {
    ...scores,
    [guesserId]: (scores[guesserId] || 0) + guessScore,
    [drawerId]: (scores[drawerId] || 0) + DRAWER_GUESS_BONUS,
  };

  return {
    accepted: true,
    scores: nextScores,
    correctGuesserIds: nextCorrectGuessers,
  };
}

export function haveAllEligiblePlayersGuessed(
  playerIds: readonly string[],
  drawerId: string,
  correctGuesserIds: ReadonlySet<string>
): boolean {
  return playerIds
    .filter((playerId) => playerId !== drawerId)
    .every((playerId) => correctGuesserIds.has(playerId));
}

export function getWinner(state: GameState): Player | undefined {
  let best: Player | undefined;
  for (const p of state.players) {
    if (!best || (state.scores[p.id] || 0) > (state.scores[best.id] || 0)) {
      best = p;
    }
  }
  return best;
}

export function createRoundState(
  roundNumber: number,
  drawerId: string,
  word: string,
  drawTimeSeconds: number = DRAW_TIME_SECONDS
): RoundState {
  return {
    roundNumber,
    drawerId,
    word,
    strokes: [],
    guesses: [],
    timeRemaining: drawTimeSeconds,
    startedAt: Date.now(),
  };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Reveal vowels while masking consonants during a drawing turn. Separators
 * such as hyphens, spaces, and punctuation remain visible.
 */
export function formatWordHint(word: string): string {
  return word
    .toLowerCase()
    .split("")
    .map((character) => {
      if (!/[a-z]/.test(character)) return character;
      return "aeiou".includes(character) ? character : "_";
    })
    .join("");
}

let systemMessageSequence = 0;

export function createSystemMessage(content: string): ChatMessage {
  const timestamp = Date.now();
  return {
    id: `system-${timestamp}-${++systemMessageSequence}`,
    playerId: "system",
    playerName: "Sistema",
    playerKind: "human",
    content,
    isGuess: false,
    isSystem: true,
    timestamp,
  };
}

export function createChatMessage(
  player: Player,
  content: string,
  isGuess: boolean,
  isCorrect?: boolean
): ChatMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    playerId: player.id,
    playerName: player.name,
    playerKind: player.kind,
    content,
    isGuess,
    isCorrect,
    timestamp: Date.now(),
  };
}

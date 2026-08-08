import { Player, GameState, ChatMessage, RoundState, PlayerKind, PetdexAvatar, RoomConfig } from "./types";

export const TECH_COMPANY_WORDS = [
  "Vercel",
  "Supabase",
  "Obsidian",
];

export const TOTAL_ROUNDS = 3;
export const DRAW_TIME_SECONDS = 60;
export const CHOOSE_WORD_TIME_SECONDS = 10;
export const ROUND_RESULT_SECONDS = 5;

export function makeHumanPlayer(id: string, name: string, avatar?: PetdexAvatar): Player {
  return { id, name, score: 0, kind: "human", avatar };
}

export function makeRoomAgentPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    score: 0,
    kind: "room-agent",
    agentConfig: { provider: "openai", model: "gpt-4o-mini" },
  };
}

export function makeByokPlayer(id: string, name: string, config: { provider: "openai"; model: string }): Player {
  return {
    id,
    name,
    score: 0,
    kind: "agent-byok",
    agentConfig: config,
  };
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

  if (roomConfig.mode === "mixed") {
    const localPlayer = makeHumanPlayer(localPlayerId, localPlayerName, localAvatar);
    players.push(localPlayer);
  }

  if (isHost) {
    for (let i = 0; i < roomConfig.agentCount; i++) {
      players.push(makeRoomAgentPlayer(`room-agent-${i}`, `Bot ${i + 1}`));
    }
  }

  const scores: Record<string, number> = {};
  for (const p of players) scores[p.id] = 0;

  return {
    roomId,
    phase: "lobby",
    players,
    currentRound: 1,
    totalRounds: TOTAL_ROUNDS,
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

export function pickThreeWords(): string[] {
  const shuffled = [...TECH_COMPANY_WORDS].sort(() => Math.random() - 0.5);
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
  const nextIndex = (state.currentDrawerIndex + 1) % state.players.length;
  const nextRound = nextIndex === 0 ? state.currentRound + 1 : state.currentRound;
  return {
    ...state,
    currentDrawerIndex: nextIndex,
    currentRound: nextRound,
  };
}

export function shouldEndGame(state: GameState): boolean {
  const totalTurns = state.currentRound * state.players.length + state.currentDrawerIndex;
  return totalTurns >= state.totalRounds * state.players.length;
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
  word: string
): RoundState {
  return {
    roundNumber,
    drawerId,
    word,
    strokes: [],
    guesses: [],
    timeRemaining: DRAW_TIME_SECONDS,
    startedAt: Date.now(),
  };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function createSystemMessage(content: string): ChatMessage {
  return {
    id: `system-${Date.now()}`,
    playerId: "system",
    playerName: "Sistema",
    playerKind: "human",
    content,
    isGuess: false,
    isSystem: true,
    timestamp: Date.now(),
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

export function playerKindBadge(kind: PlayerKind): string {
  switch (kind) {
    case "human":
      return "";
    case "agent-byok":
      return "BYOK";
    case "room-agent":
      return "BOT";
  }
}

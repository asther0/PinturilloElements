export type Player = {
  id: string;
  name: string;
  score: number;
  isAgent: boolean;
};

export type GamePhase =
  | "lobby"
  | "choosing"
  | "drawing"
  | "roundResult"
  | "gameOver";

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  content: string;
  isGuess: boolean;
  isCorrect?: boolean;
  isSystem?: boolean;
  timestamp: number;
};

export type Stroke = {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: "pen" | "eraser";
};

export type RoundState = {
  roundNumber: number;
  drawerId: string;
  word: string;
  strokes: Stroke[];
  guesses: ChatMessage[];
  timeRemaining: number;
  startedAt: number;
};

export type GameState = {
  roomId: string;
  phase: GamePhase;
  players: Player[];
  currentRound: number;
  totalRounds: number;
  roundState?: RoundState;
  currentDrawerIndex: number;
  wordsForRound: string[];
  scores: Record<string, number>;
  winnerId?: string;
};

export type PortalEvent =
  | { type: "stroke"; payload: Stroke }
  | { type: "guess"; payload: { playerId: string; content: string } }
  | { type: "roundStart"; payload: { drawerId: string; word: string; roundNumber: number } }
  | { type: "roundEnd"; payload: { word: string; scores: Record<string, number> } }
  | { type: "gameStart"; payload: { players: Player[]; totalRounds: number } }
  | { type: "gameOver"; payload: { winnerId: string; finalScores: Record<string, number> } }
  | { type: "chooseWord"; payload: { words: string[] } }
  | { type: "wordChosen"; payload: { word: string } };

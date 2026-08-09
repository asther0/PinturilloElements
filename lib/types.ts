export type PlayerKind = "human";

export type PetdexAvatar = {
  slug: string;
  displayName: string;
  spritesheetUrl: string;
  dominantColor?: string;
};

export type PortalPresenceMetadata = {
  playerId: string;
  playerKind: "human" | "spectator";
};

export type Player = {
  id: string;
  name: string;
  score: number;
  kind: PlayerKind;
  avatar?: PetdexAvatar;
};

export type GamePhase =
  | "lobby"
  | "choosing"
  | "drawing"
  | "roundResult"
  | "gameOver";

export type LateJoinPolicy = "spectator" | "closed";

export type RoomConfig = {
  humanCount: number;
  roundCount: number;
  drawTimeSeconds: number;
  lateJoin: LateJoinPolicy;
  logoCollections: string[];
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  playerKind: PlayerKind;
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
  hostId?: string;
  roomConfig: RoomConfig;
};

type PortalEventData =
  | { type: "stroke"; payload: { playerId: string; stroke: Stroke } }
  | { type: "undoLastStroke"; payload: Record<string, never> }
  | { type: "clearCanvas"; payload: Record<string, never> }
  | { type: "guess"; payload: { playerId: string; content: string } }
  | { type: "roundStart"; payload: { drawerId: string; word: string; roundNumber: number } }
  | { type: "roundEnd"; payload: { word: string; scores: Record<string, number> } }
  | { type: "gameStart"; payload: { players: Player[]; totalRounds: number } }
  | { type: "gameOver"; payload: { winnerId: string; finalScores: Record<string, number> } }
  | { type: "chooseWord"; payload: { words: string[] } }
  | { type: "wordChosen"; payload: { word: string } }
  | { type: "joinRequest"; payload: { requestId: string; targetPlayerId: string; player: Player } }
  | { type: "joinAccepted"; payload: RoomSnapshotPayload }
  | { type: "playerLeave"; payload: { playerId: string } }
  | { type: "playerHeartbeat"; payload: { playerId: string } }
  | { type: "joinRejected"; payload: { requestId: string; targetPlayerId: string; reason: "full" | "closed" } }
  | { type: "lobbySync"; payload: { players: Player[]; hostId: string; roomConfig: RoomConfig } }
  | { type: "lateJoinWaiting"; payload: { hostId: string } }
  | { type: "roomSnapshotRequest"; payload: { requesterId: string; requestId: string } }
  | { type: "roomSnapshot"; payload: RoomSnapshotPayload };

export type PortalEvent = PortalEventData & {
  eventId?: string;
  senderId?: string;
};

export type RoomSnapshotPayload = {
  requestId: string;
  targetPlayerId: string;
  roomConfig: RoomConfig;
  players: Player[];
  hostId: string;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  scores: Record<string, number>;
  currentDrawerIndex: number;
  roundState?: {
    roundNumber: number;
    drawerId: string;
    word?: string;
    timeRemaining: number;
    startedAt: number;
  };
  winnerId?: string;
};

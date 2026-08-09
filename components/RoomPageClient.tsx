"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GameState, ChatMessage, Stroke, PortalEvent, PetdexAvatar, Player, RoomConfig, LateJoinPolicy } from "@/lib/types";
import {
  createInitialState,
  pickThreeWords,
  createRoundState,
  checkGuess,
  calculateGuessScore,
  advanceDrawer,
  shouldEndGame,
  getWinner,
  createChatMessage,
  createSystemMessage,
  CHOOSE_WORD_TIME_SECONDS,
  ROUND_RESULT_SECONDS,
  isLocalPlayerDrawer,
  getCurrentDrawer,
  playerKindBadge,
  makeHumanPlayer,
  makeRoomAgentPlayer,
  DRAWER_GUESS_BONUS,
} from "@/lib/gameLogic";
import {
  buildRoomSnapshot,
  isSnapshotDirectedTo,
  applyRoomSnapshot,
} from "@/lib/roomSnapshotProtocol";
import { petdexSpriteSrc } from "@/lib/petdexImage";
import {
  PortalBridge,
  usePortal,
  useRegisterPortalEventHandler,
} from "@/components/PortalBridge";
import GameCanvas from "@/components/GameCanvas";
import ChatPanel from "@/components/ChatPanel";
import GameUI from "@/components/GameUI";

function SpriteLoading() {
  return (
    <span className="flex h-full w-full items-center justify-center">
      <svg
        aria-hidden="true"
        className="h-2/3 w-2/3 animate-spin text-zinc-500"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M21 12a9 9 0 1 1-6.22-8.56" />
      </svg>
    </span>
  );
}

function PlayerAvatar({ avatar }: { avatar?: PetdexAvatar }) {
  const spritesheetUrl = avatar?.spritesheetUrl;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Hooks stay unconditional even when avatar is absent. Reset per-image state
  // when the spritesheet URL changes so a previous sprite's loading/error state
  // never leaks onto a new avatar.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [spritesheetUrl]);

  if (!avatar) return null;

  return (
    <span
      role="img"
      aria-label={avatar.displayName}
      className="relative block h-5 w-5 shrink-0 overflow-hidden rounded-sm text-center text-[9px] font-bold leading-5 text-white"
      style={{ backgroundColor: avatar.dominantColor || "#3f3f46" }}
    >
      {!loaded && !failed && <SpriteLoading />}
      {failed && avatar.displayName.slice(0, 1).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden="true"
        src={petdexSpriteSrc(avatar.spritesheetUrl)}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute left-0 top-0 h-auto w-[800%] max-w-none [image-rendering:pixelated] ${failed ? "hidden" : ""}`}
      />
    </span>
  );
}

const BOT_DRAWINGS: Record<string, Stroke[]> = {
  vercel: [
    { points: [{ x: 250, y: 330 }, { x: 370, y: 135 }], color: "#18181b", width: 7, tool: "pen" },
    { points: [{ x: 370, y: 135 }, { x: 490, y: 330 }], color: "#18181b", width: 7, tool: "pen" },
    { points: [{ x: 490, y: 330 }, { x: 250, y: 330 }], color: "#18181b", width: 7, tool: "pen" },
  ],
  supabase: [
    { points: [{ x: 330, y: 125 }, { x: 245, y: 275 }, { x: 345, y: 275 }], color: "#34d399", width: 8, tool: "pen" },
    { points: [{ x: 410, y: 345 }, { x: 495, y: 195 }, { x: 395, y: 195 }], color: "#10b981", width: 8, tool: "pen" },
    { points: [{ x: 345, y: 275 }, { x: 395, y: 195 }], color: "#065f46", width: 6, tool: "pen" },
  ],
  obsidian: [
    { points: [{ x: 370, y: 115 }, { x: 480, y: 205 }, { x: 445, y: 345 }, { x: 370, y: 380 }, { x: 275, y: 310 }, { x: 260, y: 190 }, { x: 370, y: 115 }], color: "#8b5cf6", width: 7, tool: "pen" },
    { points: [{ x: 260, y: 190 }, { x: 370, y: 245 }, { x: 480, y: 205 }], color: "#6d28d9", width: 6, tool: "pen" },
    { points: [{ x: 370, y: 245 }, { x: 370, y: 380 }], color: "#6d28d9", width: 6, tool: "pen" },
  ],
};

function getBotDrawing(word: string): Stroke[] {
  return BOT_DRAWINGS[word.toLowerCase()] || [
    { points: [{ x: 275, y: 150 }, { x: 465, y: 150 }, { x: 465, y: 340 }, { x: 275, y: 340 }, { x: 275, y: 150 }], color: "#0f766e", width: 7, tool: "pen" },
    { points: [{ x: 310, y: 245 }, { x: 350, y: 285 }, { x: 430, y: 205 }], color: "#0f766e", width: 7, tool: "pen" },
  ];
}

// Heartbeat-based human liveness. Non-host humans announce themselves every
// HEARTBEAT_INTERVAL_MS while the lobby is open; the host prunes a non-host
// human after HUMAN_TIMEOUT_MS without a heartbeat (or detailed presence
// sighting). PRUNE_INTERVAL_MS is how often the host re-checks liveness.
const HEARTBEAT_INTERVAL_MS = 8000;
const HUMAN_TIMEOUT_MS = 30000;
const PRUNE_INTERVAL_MS = 5000;

function sameLobbyPlayers(left: Player[], right: Player[]): boolean {
  return left.length === right.length && left.every((player, index) => {
    const candidate = right[index];
    return candidate && player.id === candidate.id && player.name === candidate.name && player.kind === candidate.kind && player.score === candidate.score;
  });
}

function sameRoomConfig(left: RoomConfig, right: RoomConfig): boolean {
  return (
    left.mode === right.mode &&
    left.humanCapacity === right.humanCapacity &&
    left.agentCount === right.agentCount &&
    left.difficulty === right.difficulty &&
    left.totalRounds === right.totalRounds &&
    left.drawTimeSeconds === right.drawTimeSeconds &&
    left.lateJoinPolicy === right.lateJoinPolicy &&
    left.logoCollections.join(",") === right.logoCollections.join(",")
  );
}

const TRY_ELEMENTS_LOGOS: Record<string, string> = {
  vercel: "https://tryelements.dev/r/svg/vercel-logo.svg",
  supabase: "https://tryelements.dev/r/svg/supabase-logo.svg",
  obsidian: "https://tryelements.dev/r/svg/obsidian-logo.svg",
};

const PETDEX_AVATARS: PetdexAvatar[] = [
  { slug: "nezukocoder", displayName: "NezukoCoder", spritesheetUrl: "https://assets.petdex.dev/pets/nezukocoder-7d766f7c2597/sprite.webp", dominantColor: "#c65922" },
  { slug: "shinchan", displayName: "Shinchan", spritesheetUrl: "https://assets.petdex.dev/pets/shinchan-154a84d8ff3c/sprite.webp", dominantColor: "#de1f1a" },
  { slug: "capvolt", displayName: "Capvolt", spritesheetUrl: "https://assets.petdex.dev/pets/capvolt-7be64ef6cfa2/sprite.webp", dominantColor: "#f7d605" },
  { slug: "doraemon", displayName: "Doraemon", spritesheetUrl: "https://assets.petdex.dev/pets/doraemon-58b12a5012e0/sprite.webp", dominantColor: "#048ae1" },
  { slug: "lulu-capybara", displayName: "Lulu", spritesheetUrl: "https://assets.petdex.dev/pets/lulu-capybara-9f9107636ecc/sprite.webp", dominantColor: "#a67c52" },
  { slug: "qqpet-codex", displayName: "QQPet", spritesheetUrl: "https://assets.petdex.dev/pets/qqpet-codex-pending-6c6a5a48a512/sprite.png", dominantColor: "#3b82f6" },
];

function getAgentAvatar(index: number): PetdexAvatar {
  return PETDEX_AVATARS[index % PETDEX_AVATARS.length];
}

function CompanyLogo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = TRY_ELEMENTS_LOGOS[company.toLowerCase()];

  if (!logoUrl || failed) {
    return (
      <span
        role="img"
        aria-label={`Logo de ${company} no disponible`}
        className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-xs font-black tracking-wider text-zinc-300"
      >
        {company.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white p-2 shadow-sm">
      {/* TryElements serves these official marks as standalone SVG assets. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={`Logo de ${company}`}
        className="h-full w-full object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

export default function RoomPageClient({
  roomId,
  playerName,
  localPlayerId,
  isHost,
  roomConfig,
  avatar,
}: {
  roomId: string;
  playerName: string;
  localPlayerId: string;
  isHost: boolean;
  roomConfig: RoomConfig;
  avatar?: PetdexAvatar;
}) {
  return (
    <PortalBridge
      roomId={roomId}
      presenceMetadata={{
        playerId: localPlayerId,
        playerKind: roomConfig.mode === "mixed" ? "human" : "spectator",
      }}
    >
      <RoomInner roomId={roomId} playerName={playerName} localPlayerId={localPlayerId} isHost={isHost} roomConfig={roomConfig} avatar={avatar} />
    </PortalBridge>
  );
}

function RoomInner({
  roomId,
  playerName,
  localPlayerId,
  isHost,
  roomConfig,
  avatar,
}: {
  roomId: string;
  playerName: string;
  localPlayerId: string;
  isHost: boolean;
  roomConfig: RoomConfig;
  avatar?: PetdexAvatar;
}) {
  const [game, setGame] = useState<GameState>(() => {
    const initial = createInitialState(roomId, localPlayerId, playerName, isHost, roomConfig, avatar);
    if (!isHost && roomConfig.mode === "mixed") {
      return { ...initial, players: [], scores: {} };
    }
    let agentIndex = 0;
    const players = initial.players.map((p) => {
      if (p.kind === "room-agent") {
        const idx = agentIndex++;
        const agentAvatar = getAgentAvatar(idx);
        return { ...p, name: agentAvatar.displayName, avatar: agentAvatar };
      }
      return p;
    });
    return { ...initial, players };
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chosenWord, setChosenWord] = useState<string | null>(null);
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(0);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [copiedCode, setCopiedCode] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [lateWaiting, setLateWaiting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    mode: "mixed" | "agents-only";
    humanCapacity: number;
    agentCount: number;
    difficulty: "easy" | "medium" | "hard";
    totalRounds: number;
    drawTimeSeconds: number;
    lateJoin: LateJoinPolicy;
  }>({
    mode: roomConfig.mode,
    humanCapacity: roomConfig.humanCapacity,
    agentCount: roomConfig.agentCount,
    difficulty: roomConfig.difficulty || "medium",
    totalRounds: roomConfig.totalRounds,
    drawTimeSeconds: roomConfig.drawTimeSeconds,
    lateJoin: roomConfig.lateJoinPolicy,
  });
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimeRef = useRef(0);
  const botRoundsStartedRef = useRef(new Set<string>());
  const gameRef = useRef(game);
  const hasAnnouncedJoinRef = useRef(false);
  const lastLobbySyncSignatureRef = useRef<string | null>(null);
  const pendingJoinsRef = useRef(new Set<string>());
  const lastSeenRef = useRef(new Map<string, number>());
  const pruneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usedWordsRef = useRef(new Set<string>());
  // Player ids that already earned the drawer bonus for the current round, so
  // duplicate correct guesses never grant it twice to the same guesser.
  const drawerBonusAwardedRef = useRef(new Set<string>());
  const lastSnapshotRequestIdRef = useRef<string | null>(null);
  const lastSnapshotResponseIdRef = useRef<string | null>(null);
  gameRef.current = game;

  const isDrawer = isLocalPlayerDrawer(game, localPlayerId);
  const currentDrawer = getCurrentDrawer(game);
  const currentDrawerId = currentDrawer?.id;
  const currentDrawerKind = currentDrawer?.kind;
  const roundStartedAt = game.roundState?.startedAt;
  const roundWord = game.roundState?.word;

  const handleEvent = useCallback((event: PortalEvent) => {
    const g = gameRef.current;
    switch (event.type) {
      case "gameStart": {
        setGame((prev) => ({
          ...prev,
          phase: "choosing",
          players: event.payload.players,
          totalRounds: event.payload.totalRounds,
        }));
        break;
      }
      case "chooseWord": {
        setGame((prev) => ({ ...prev, phase: "choosing", wordsForRound: event.payload.words }));
        break;
      }
      case "wordChosen": {
        const word = event.payload.word;
        drawerBonusAwardedRef.current.clear();
        setChosenWord(word);
        setLocalStrokes([]);
        if (g.hostId === localPlayerId) usedWordsRef.current.add(word);
        const drawer = getCurrentDrawer(g);
        if (drawer) {
          setGame((prev) => ({
            ...prev,
            phase: "drawing",
            roundState: createRoundState(prev.currentRound, drawer.id, word, g.roomConfig.drawTimeSeconds),
          }));
          setMessages((prev) => [
            ...prev,
            createSystemMessage(`Ronda ${g.currentRound} de ${g.totalRounds}: ${drawer.name} dibuja`),
          ]);
        }
        break;
      }
      case "stroke": {
        if (event.payload.playerId !== g.roundState?.drawerId) break;
        setLocalStrokes((prev) => [...prev, event.payload.stroke]);
        setGame((prev) => {
          if (!prev.roundState) return prev;
          return {
            ...prev,
            roundState: {
              ...prev.roundState,
              strokes: [...prev.roundState.strokes, event.payload.stroke],
            },
          };
        });
        break;
      }
      case "undoLastStroke": {
        setLocalStrokes((prev) => prev.slice(0, -1));
        setGame((prev) => {
          if (!prev.roundState) return prev;
          return {
            ...prev,
            roundState: {
              ...prev.roundState,
              strokes: prev.roundState.strokes.slice(0, -1),
            },
          };
        });
        break;
      }
      case "clearCanvas": {
        setLocalStrokes([]);
        setGame((prev) => {
          if (!prev.roundState) return prev;
          return {
            ...prev,
            roundState: {
              ...prev.roundState,
              strokes: [],
            },
          };
        });
        break;
      }
      case "guess": {
        const guesser = g.players.find((p) => p.id === event.payload.playerId);
        if (!guesser) break;
        if (guesser.id === g.roundState?.drawerId) break;
        const word = g.roundState?.word;
        const correct = word ? checkGuess(event.payload.content, word) : false;
        const msg = createChatMessage(guesser, event.payload.content, true, correct);
        setMessages((prev) => [...prev, msg]);
        if (correct && word) {
          const score = calculateGuessScore(g.roundState?.timeRemaining || 0, g.roomConfig.drawTimeSeconds);
          const drawerId = g.roundState?.drawerId;
          const firstCorrect = !drawerBonusAwardedRef.current.has(guesser.id);
          if (firstCorrect) drawerBonusAwardedRef.current.add(guesser.id);
          setGame((prev) => {
            const newScores = { ...prev.scores, [guesser.id]: (prev.scores[guesser.id] || 0) + score };
            if (firstCorrect && drawerId) {
              newScores[drawerId] = (newScores[drawerId] || 0) + DRAWER_GUESS_BONUS;
            }
            return { ...prev, scores: newScores };
          });
          setMessages((prev) => [
            ...prev,
            createSystemMessage(`${guesser.name} acertó (+${score} pts)`),
            ...(firstCorrect && drawerId
              ? [createSystemMessage(`El dibujante suma +${DRAWER_GUESS_BONUS} pts por la respuesta de ${guesser.name}`)]
              : []),
          ]);
        }
        break;
      }
      case "roundEnd": {
        setGame((prev) => {
          const updatedScores = { ...prev.scores, ...event.payload.scores };
          return { ...prev, phase: "roundResult", scores: updatedScores };
        });
        setMessages((prev) => [
          ...prev,
          createSystemMessage(`La palabra era: ${event.payload.word}`),
        ]);
        break;
      }
      case "gameOver": {
        setGame((prev) => ({
          ...prev,
          phase: "gameOver",
          scores: event.payload.finalScores,
          winnerId: event.payload.winnerId,
        }));
        break;
      }
      case "playerJoin": {
        if (g.hostId !== localPlayerId) break;
        const player = event.payload.player;
        lastSeenRef.current.set(player.id, Date.now());
        if (g.phase !== "lobby") {
          if (g.roomConfig.lateJoinPolicy === "closed") {
            portalRef.current.send({
              type: "joinRejected",
              payload: { playerId: player.id, reason: "closed" },
            });
          } else {
            portalRef.current.send({
              type: "lateJoinWaiting",
              payload: { hostId: localPlayerId },
            });
          }
          break;
        }
        const isHuman = player.kind === "human" && Boolean(player.id) && Boolean(player.name.trim());
        const alreadyPresent =
          g.players.some((p) => p.id === player.id) || pendingJoinsRef.current.has(player.id);
        if (!alreadyPresent && isHuman && g.roomConfig.mode === "mixed") {
          const humanCount = g.players.filter((p) => p.kind === "human").length;
          if (humanCount + pendingJoinsRef.current.size >= g.roomConfig.humanCapacity) {
            portalRef.current.send({
              type: "joinRejected",
              payload: { playerId: player.id, reason: "full" },
            });
            break;
          }
          pendingJoinsRef.current.add(player.id);
          setGame((prev) => {
            pendingJoinsRef.current.delete(player.id);
            return {
              ...prev,
              players: [...prev.players, player],
              scores: { ...prev.scores, [player.id]: player.score },
            };
          });
        }
        break;
      }
      case "playerLeave": {
        if (g.hostId !== localPlayerId || g.phase !== "lobby") break;
        lastSeenRef.current.delete(event.payload.playerId);
        pendingJoinsRef.current.delete(event.payload.playerId);
        setGame((prev) => {
          const leavingPlayer = prev.players.find((player) => player.id === event.payload.playerId);
          if (!leavingPlayer || leavingPlayer.kind !== "human" || leavingPlayer.id === localPlayerId) return prev;
          const players = prev.players.filter((player) => player.id !== event.payload.playerId);
          const scores = Object.fromEntries(
            Object.entries(prev.scores).filter(([playerId]) => playerId !== event.payload.playerId)
          );
          return { ...prev, players, scores };
        });
        break;
      }
      case "playerHeartbeat": {
        if (g.hostId !== localPlayerId || g.phase !== "lobby") break;
        lastSeenRef.current.set(event.payload.playerId, Date.now());
        break;
      }
      case "joinRejected": {
        if (event.payload.playerId !== localPlayerId) break;
        if (event.payload.reason === "full") setRoomFull(true);
        if (event.payload.reason === "closed") setRoomClosed(true);
        break;
      }
      case "lobbySync": {
        if (g.hostId === localPlayerId) break;
        setGame((prev) => {
          if (
            prev.hostId === event.payload.hostId &&
            sameLobbyPlayers(prev.players, event.payload.players) &&
            sameRoomConfig(prev.roomConfig, event.payload.roomConfig)
          ) return prev;
          return {
            ...prev,
            players: event.payload.players,
            hostId: event.payload.hostId,
            roomConfig: event.payload.roomConfig,
          };
        });
        break;
      }
      case "lateJoinWaiting": {
        if (g.hostId === localPlayerId) break;
        if (g.players.some((p) => p.id === localPlayerId)) break;
        setLateWaiting(true);
        break;
      }
      case "roomSnapshotRequest": {
        if (!isHost) break;
        const requesterId = event.senderId;
        const requestId = event.payload.requestId;
        if (!requesterId || !requestId) break;
        // Broadcast a snapshot correlated by requestId + targetPlayerId.
        // Every connected client receives it, but only the requesting guest
        // applies the payload. This avoids Portal unicast rejection of
        // anonymous recipients and never leaks the secret word or choices.
        const snapshot = buildRoomSnapshot(
          g,
          { requestId, targetPlayerId: requesterId },
          g.hostId || localPlayerId
        );
        portalRef.current.send({ type: "roomSnapshot", payload: snapshot });
        break;
      }
      case "roomSnapshot": {
        if (isHost) break;
        const payload = event.payload;
        // Apply only snapshots directed to this guest's active request.
        if (!isSnapshotDirectedTo(payload, lastSnapshotRequestIdRef.current, localPlayerId)) break;
        if (payload.requestId === lastSnapshotResponseIdRef.current) break;
        lastSnapshotResponseIdRef.current = payload.requestId;
        setGame((prev) => applyRoomSnapshot(prev, payload));
        break;
      }
    }
  }, [localPlayerId, isHost]);

  useRegisterPortalEventHandler(handleEvent);
  const portal = usePortal();
  const portalRef = useRef(portal);
  portalRef.current = portal;

  // Non-hosts announce themselves only after Portal is ready. They join the local
  // roster only after the host accepts them in a lobbySync event.
  useEffect(() => {
    if (!isHost && portal.connected && !hasAnnouncedJoinRef.current) {
      hasAnnouncedJoinRef.current = true;
      const localPlayer = makeHumanPlayer(localPlayerId, playerName, avatar);
      portal.send({
        type: "playerJoin",
        payload: { player: localPlayer },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, portal.connected, roomId]);

  // Non-hosts request a state snapshot from the host after connecting. This is
  // the primary hydration mechanism for late-joiners because useChannel uses
  // history="none"; without an explicit request, a guest may never see the
  // current room state if it missed the last broadcast lobbySync.
  useEffect(() => {
    if (isHost || !portal.connected || lastSnapshotRequestIdRef.current != null) return;
    const requestId = globalThis.crypto?.randomUUID?.() || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    lastSnapshotRequestIdRef.current = requestId;
    portal.send({
      type: "roomSnapshotRequest",
      payload: { requesterId: localPlayerId, requestId },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, portal.connected, localPlayerId, roomId]);

  // Reset snapshot tracking on disconnect so a reconnection triggers a fresh
  // request/response pair and never applies a stale snapshot.
  useEffect(() => {
    if (!portal.connected) {
      lastSnapshotRequestIdRef.current = null;
      lastSnapshotResponseIdRef.current = null;
    }
  }, [portal.connected]);

  // Non-host humans announce liveness to the host: once on Portal readiness
  // and then every HEARTBEAT_INTERVAL_MS while the lobby is open. The host
  // uses these heartbeats to prune silent humans.
  useEffect(() => {
    if (isHost || game.phase !== "lobby" || game.roomConfig.mode !== "mixed") return;
    if (!portal.connected) return;
    const sendHeartbeat = () => {
      portalRef.current.send({ type: "playerHeartbeat", payload: { playerId: localPlayerId } });
    };
    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(heartbeatTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, game.phase, game.roomConfig.mode, portal.connected, localPlayerId]);

  // The host is the authority for the lobby roster. Re-publish its initial
  // state once connected and every accepted roster update.
  useEffect(() => {
    if (!isHost || game.phase !== "lobby") return;
    if (!portal.connected) {
      lastLobbySyncSignatureRef.current = null;
      return;
    }
    const payload = {
      players: game.players,
      hostId: localPlayerId,
      roomConfig: game.roomConfig,
    };
    const signature = JSON.stringify(payload);
    if (lastLobbySyncSignatureRef.current === signature) return;

    lastLobbySyncSignatureRef.current = signature;
    portal.send({
      type: "lobbySync",
      payload,
    });
  }, [game.phase, game.players, game.roomConfig, isHost, localPlayerId, portal]);

  // Host-side human liveness while in the lobby. The host tracks the last
  // heartbeat per non-host human. A non-host human that stays silent for
  // HUMAN_TIMEOUT_MS is removed from the roster, its score, and any pending
  // join. Liveness is fed only by playerHeartbeat events and playerJoin; a
  // stale Portal presence snapshot can never mask an expired human. The host
  // stays alive independently. The periodic recheck only mutates game state
  // when a player actually expires, so it never causes an update loop.
  useEffect(() => {
    if (!isHost || game.phase !== "lobby") {
      if (pruneIntervalRef.current) {
        clearInterval(pruneIntervalRef.current);
        pruneIntervalRef.current = null;
      }
      return;
    }

    const applyFilter = (filterNow: number) => {
      setGame((prev) => {
        if (prev.phase !== "lobby" || prev.hostId !== localPlayerId) return prev;
        let removed = false;
        const players = prev.players.filter((player) => {
          if (player.kind !== "human" || player.id === prev.hostId) return true;
          const lastSeen = lastSeenRef.current.get(player.id);
          if (lastSeen && filterNow - lastSeen <= HUMAN_TIMEOUT_MS) return true;
          lastSeenRef.current.delete(player.id);
          pendingJoinsRef.current.delete(player.id);
          removed = true;
          return false;
        });
        if (!removed) return prev;
        const scores = Object.fromEntries(
          Object.entries(prev.scores).filter(([playerId]) => players.some((p) => p.id === playerId))
        );
        return { ...prev, players, scores };
      });
    };

    const tick = () => {
      const now = Date.now();
      // The host stays alive independently; non-host liveness is refreshed
      // only by playerJoin and playerHeartbeat events.
      lastSeenRef.current.set(localPlayerId, now);
      applyFilter(now);
    };

    tick();
    pruneIntervalRef.current = setInterval(tick, PRUNE_INTERVAL_MS);

    return () => {
      if (pruneIntervalRef.current) {
        clearInterval(pruneIntervalRef.current);
        pruneIntervalRef.current = null;
      }
    };
  }, [game.phase, isHost, localPlayerId]);

  useEffect(() => {
    return () => {
      if (roomConfig.mode === "mixed") {
        portalRef.current.send({ type: "playerLeave", payload: { playerId: localPlayerId } });
      }
    };
  }, [localPlayerId, roomConfig.mode]);

  useEffect(() => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);

    if (game.phase === "choosing") {
      phaseTimeRef.current = CHOOSE_WORD_TIME_SECONDS;
    } else if (game.phase === "drawing") {
      phaseTimeRef.current = gameRef.current.roomConfig.drawTimeSeconds;
    } else if (game.phase === "roundResult") {
      phaseTimeRef.current = ROUND_RESULT_SECONDS;
    } else {
      setPhaseTimeLeft(0);
      return;
    }

    setPhaseTimeLeft(phaseTimeRef.current);

    phaseTimerRef.current = setInterval(() => {
      phaseTimeRef.current -= 1;
      setPhaseTimeLeft(phaseTimeRef.current);

      if (phaseTimeRef.current <= 0) {
        if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);

        if (gameRef.current.phase === "choosing") {
          if (isHost) {
            const word = gameRef.current.wordsForRound[0] || pickThreeWords(gameRef.current.roomConfig.logoCollections, usedWordsRef.current)[0];
            portal.send({ type: "wordChosen", payload: { word } });
          }
        } else if (gameRef.current.phase === "drawing") {
          if (isHost) {
            portal.send({
              type: "roundEnd",
              payload: {
                word: gameRef.current.roundState?.word || "",
                scores: gameRef.current.scores,
              },
            });
          }
        } else if (gameRef.current.phase === "roundResult") {
          if (shouldEndGame(gameRef.current)) {
            if (isHost) {
              const winner = getWinner(gameRef.current);
              portal.send({
                type: "gameOver",
                payload: {
                  winnerId: winner?.id || "",
                  finalScores: gameRef.current.scores,
                },
              });
            }
          } else {
            const next = advanceDrawer(gameRef.current);
            setGame(next);
            if (isHost) {
              portal.send({
                type: "chooseWord",
                payload: { words: pickThreeWords(gameRef.current.roomConfig.logoCollections, usedWordsRef.current) },
              });
            }
          }
        }
      }
    }, 1000);

    return () => {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
  }, [game.phase, isHost, portal]);

  useEffect(() => {
    if (
      game.phase !== "drawing" ||
      !roundStartedAt ||
      !roundWord ||
      !currentDrawerId ||
      !currentDrawerKind
    ) {
      return;
    }
    if (currentDrawerKind === "human") return;
    if (!isHost) return;

    const roundKey = `${game.currentRound}:${currentDrawerId}:${roundStartedAt}`;
    if (botRoundsStartedRef.current.has(roundKey)) return;
    botRoundsStartedRef.current.add(roundKey);

    const timers = getBotDrawing(roundWord).map((stroke, index) =>
      setTimeout(() => {
        portal.send({ type: "stroke", payload: { playerId: currentDrawerId, stroke } });
      }, 700 + index * 750)
    );

    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [
    currentDrawerId,
    currentDrawerKind,
    game.currentRound,
    game.phase,
    isHost,
    portal,
    roundStartedAt,
    roundWord,
  ]);

  // Room-funded agent guess logic
  useEffect(() => {
    if (game.phase !== "drawing" || !game.roundState) return;
    if (!isHost) return;

    const roomAgent = game.players.find((p) => p.kind === "room-agent");
    if (!roomAgent) return;
    if (roomAgent.id === game.roundState.drawerId) return;

    const delay = 10000 + Math.random() * 30000;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/agent-guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strokes: gameRef.current.roundState?.strokes || [],
            candidates: gameRef.current.wordsForRound.length
              ? gameRef.current.wordsForRound
              : pickThreeWords(gameRef.current.roomConfig.logoCollections, usedWordsRef.current),
            difficulty: gameRef.current.roomConfig.difficulty || "medium",
          }),
        });
        const data = await res.json();
        const guess = data.guess || "";
        if (guess) {
          portal.send({
            type: "guess",
            payload: { playerId: roomAgent.id, content: guess },
          });
        }
      } catch {
        // Silently fail; never log sensitive info
      }
    }, delay);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.roundState?.word, game.players, isHost, portal]);

  // Simple BYOK / legacy agent guess fallback (random delay, no real model call)
  useEffect(() => {
    if (game.phase !== "drawing" || !game.roundState) return;
    if (!isHost) return;

    const nonRoomAgents = game.players.filter(
      (p) =>
        p.kind === "agent-byok" && p.id !== game.roundState?.drawerId
    );
    if (nonRoomAgents.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const agent of nonRoomAgents) {
      const delay = 10000 + Math.random() * 30000;
      const t = setTimeout(() => {
        portal.send({
          type: "guess",
          payload: { playerId: agent.id, content: game.roundState?.word || "" },
        });
      }, delay);
      timers.push(t);
    }

    return () => {
      for (const t of timers) clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase, game.roundState?.word, game.players, isHost, portal]);

  const handleChooseWord = (word: string) => {
    if (!isDrawer && !isHost) return;
    portal.send({ type: "wordChosen", payload: { word } });
  };

  const handleSendGuess = (text: string) => {
    portal.send({
      type: "guess",
      payload: { playerId: localPlayerId, content: text },
    });
  };

  const handleStroke = (stroke: Stroke) => {
    portal.send({ type: "stroke", payload: { playerId: localPlayerId, stroke } });
  };

  const handleUndo = () => {
    portal.send({ type: "undoLastStroke", payload: {} });
  };

  const handleClear = () => {
    portal.send({ type: "clearCanvas", payload: {} });
  };

  const handleEndRoundEarly = () => {
    if (!isDrawer && !isHost) return;
    portal.send({
      type: "roundEnd",
      payload: {
        word: game.roundState?.word || "",
        scores: game.scores,
      },
    });
  };

  const handleNewGame = () => {
    setMessages([]);
    setLocalStrokes([]);
    setChosenWord(null);
    botRoundsStartedRef.current.clear();
    usedWordsRef.current.clear();
    const fresh = createInitialState(roomId, localPlayerId, playerName, isHost, roomConfig, avatar);
    setGame(fresh);
    setTimeout(() => {
      portal.send({
        type: "gameStart",
        payload: { players: fresh.players, totalRounds: fresh.totalRounds },
      });
      portal.send({
        type: "chooseWord",
        payload: { words: pickThreeWords(fresh.roomConfig.logoCollections, usedWordsRef.current) },
      });
    }, 300);
  };

  const handleStartGame = () => {
    if (!isHost) return;
    const activeCount = game.roomConfig.mode === "agents-only"
      ? game.players.length
      : game.players.length;
    if (activeCount < 2) return;
    usedWordsRef.current.clear();
    portal.send({
      type: "gameStart",
      payload: { players: game.players, totalRounds: game.totalRounds },
    });
    portal.send({
      type: "chooseWord",
      payload: { words: pickThreeWords(game.roomConfig.logoCollections, usedWordsRef.current) },
    });
  };

  const openEditModal = () => {
    const cfg = gameRef.current.roomConfig;
    setEditDraft({
      mode: cfg.mode,
      humanCapacity: cfg.humanCapacity,
      agentCount: cfg.agentCount,
      difficulty: cfg.difficulty || "medium",
      totalRounds: cfg.totalRounds,
      drawTimeSeconds: cfg.drawTimeSeconds,
      lateJoin: cfg.lateJoinPolicy,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveRoomConfig = () => {
    if (!isHost || game.phase !== "lobby") return;
    const newConfig: RoomConfig = {
      mode: editDraft.mode,
      humanCapacity: editDraft.mode === "mixed" ? editDraft.humanCapacity : 0,
      agentCount: editDraft.agentCount,
      ...(editDraft.agentCount > 0 ? { difficulty: editDraft.difficulty } : {}),
      totalRounds: editDraft.totalRounds,
      drawTimeSeconds: editDraft.drawTimeSeconds,
      lateJoinPolicy: editDraft.lateJoin,
      logoCollections: gameRef.current.roomConfig.logoCollections,
    };
    setGame((prev) => {
      const humans = prev.players.filter((p) => p.kind === "human");
      const byokAgents = prev.players.filter((p) => p.kind === "agent-byok");
      const existingRoomAgents = new Map(prev.players.filter((p) => p.kind === "room-agent").map((p) => [p.id, p]));
      const newRoomAgents: Player[] = [];
      for (let i = 0; i < editDraft.agentCount; i++) {
        const id = `room-agent-${i}`;
        const existing = existingRoomAgents.get(id);
        const agentAvatar = getAgentAvatar(i);
        if (existing) {
          newRoomAgents.push({ ...existing, name: agentAvatar.displayName });
        } else {
          newRoomAgents.push({ ...makeRoomAgentPlayer(id, agentAvatar.displayName), avatar: agentAvatar });
        }
      }
      let players: Player[];
      if (editDraft.mode === "agents-only") {
        players = [...byokAgents, ...newRoomAgents];
      } else {
        const hostHuman = humans.find((p) => p.id === localPlayerId);
        const otherHumans = humans.filter((p) => p.id !== localPlayerId);
        const newHumans = hostHuman
          ? [hostHuman, ...otherHumans]
          : [makeHumanPlayer(localPlayerId, playerName, avatar), ...otherHumans];
        players = [...newHumans, ...byokAgents, ...newRoomAgents];
      }
      const scores: Record<string, number> = {};
      for (const p of players) {
        scores[p.id] = prev.scores[p.id] || 0;
      }
      return { ...prev, roomConfig: newConfig, players, scores };
    });
    setIsEditModalOpen(false);
  };

  const totalSeats = game.players.length;
  const canStart = totalSeats >= 2;

  async function copyToClipboard(text: string) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const success = document.execCommand("copy");
      document.body.removeChild(textArea);
      return success;
    } catch {
      return false;
    }
  }

  const isAgentOnly = game.roomConfig.mode === "agents-only";
  const humanCount = game.players.filter((p) => p.kind === "human").length;
  const roomAgentCount = game.players.filter((p) => p.kind === "room-agent").length;

  function difficultyLabel(d: "easy" | "medium" | "hard"): string {
    switch (d) {
      case "easy": return "Fácil";
      case "medium": return "Media";
      case "hard": return "Difícil";
    }
  }

  if (roomFull) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-900 px-4 text-white">
        <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-7 text-center shadow-2xl">
          <h1 className="text-2xl font-extrabold">La sala está llena</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">El host ya alcanzó el límite de jugadores humanos para esta sala.</p>
          <Link href="/" className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400">Volver al inicio</Link>
        </section>
      </main>
    );
  }

  if (roomClosed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-900 px-4 text-white">
        <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-7 text-center shadow-2xl">
          <h1 className="text-2xl font-extrabold">La sala está cerrada</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">La partida ya comenzó y la sala no admite espectadores.</p>
          <Link href="/" className="mt-6 inline-flex rounded-xl bg-emerald-500 px-5 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400">Volver al inicio</Link>
        </section>
      </main>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-900 text-white">
      {isEditModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-10 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Editar sala</h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                aria-label="Cerrar"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Modo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditDraft((d) => ({ ...d, mode: "mixed" }))}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${editDraft.mode === "mixed" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                >
                  Mixta
                </button>
                <button
                  type="button"
                  onClick={() => setEditDraft((d) => ({ ...d, mode: "agents-only" }))}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${editDraft.mode === "agents-only" ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                >
                  Solo agentes
                </button>
              </div>
            </div>

            {editDraft.mode === "mixed" && (
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Capacidad humana</label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 4, 6, 8].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setEditDraft((d) => ({ ...d, humanCapacity: cap }))}
                      className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${editDraft.humanCapacity === cap ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
                {editDraft.humanCapacity < humanCount && (
                  <p className="mt-2 text-xs text-red-400">La capacidad no puede ser menor que los humanos actuales ({humanCount}).</p>
                )}
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Agentes</label>
              <div className="grid grid-cols-6 gap-2">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEditDraft((d) => ({ ...d, agentCount: n }))}
                    className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${editDraft.agentCount === n ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {editDraft.agentCount > 0 && (
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Dificultad</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["easy", "medium", "hard"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setEditDraft((prev) => ({ ...prev, difficulty: d }))}
                      className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${editDraft.difficulty === d ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                    >
                      {difficultyLabel(d)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Rondas</label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 4, 5].map((rounds) => (
                  <button
                    key={rounds}
                    type="button"
                    onClick={() => setEditDraft((d) => ({ ...d, totalRounds: rounds }))}
                    className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${editDraft.totalRounds === rounds ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                  >
                    {rounds}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Tiempo de dibujo</label>
              <div className="grid grid-cols-3 gap-2">
                {[45, 60, 90].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => setEditDraft((d) => ({ ...d, drawTimeSeconds: seconds }))}
                    className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${editDraft.drawTimeSeconds === seconds ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                  >
                    {seconds}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500">Entrada tardía</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditDraft((d) => ({ ...d, lateJoin: "spectator" }))}
                  className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${editDraft.lateJoin === "spectator" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                >
                  Espectador
                </button>
                <button
                  type="button"
                  onClick={() => setEditDraft((d) => ({ ...d, lateJoin: "closed" }))}
                  className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${editDraft.lateJoin === "closed" ? "border-sky-500 bg-sky-500/10 text-sky-400" : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                >
                  Cerrada
                </button>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRoomConfig}
                disabled={editDraft.mode === "mixed" && editDraft.humanCapacity < humanCount}
                className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {game.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-10">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center">
              <div className="mb-3 flex items-center justify-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Sala pública
                </span>
                {isAgentOnly ? (
                  <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-400">
                    Solo agentes
                  </span>
                ) : (
                  <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-sky-400">
                    Mixta
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Sala de espera
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                {isAgentOnly
                  ? "Espectador. Los agentes competirán entre ellos."
                  : "Esperando jugadores para empezar la partida."}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-2xl sm:p-6">
              <div className="mb-4 text-center">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Código de sala
                </div>
                <div className="mt-1 text-3xl font-black tracking-widest text-white">
                  {roomId.toUpperCase()}
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(roomId.toUpperCase());
                    if (ok) {
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-emerald-500 hover:bg-zinc-700"
                >
                  {copiedCode ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Copiado
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                      Copiar código
                    </>
                  )}
                </button>
              </div>

              {lateWaiting && (
                <div className="mt-5 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-3 py-2.5 text-sm text-zinc-300">
                  La partida ya comenzó. Puedes esperar a que termine para unirte.
                </div>
              )}

              <div className="mt-5 border-t border-zinc-800 pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Roster
                  </span>
                  <div className="flex items-center gap-2">
                    {isAgentOnly && game.roomConfig.difficulty && (
                      <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-300">
                        {difficultyLabel(game.roomConfig.difficulty)}
                      </span>
                    )}
                    {!isAgentOnly && (
                      <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-300">
                        {humanCount} / {game.roomConfig.humanCapacity} humanos
                      </span>
                    )}
                    <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-300">
                      {roomAgentCount} / {game.roomConfig.agentCount} agentes
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold text-zinc-300">
                      {totalSeats} activo{totalSeats === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {game.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5"
                    >
                      <PlayerAvatar avatar={p.avatar} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                          {p.name}
                          {p.kind !== "human" && (
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                              {p.kind === "room-agent" ? "AGENTE" : playerKindBadge(p.kind)}
                            </span>
                          )}
                        </div>
                        {p.id === localPlayerId && (
                          <div className="text-[11px] text-zinc-500">Tú</div>
                        )}
                        {p.id === game.hostId && p.id !== localPlayerId && (
                          <div className="text-[11px] text-amber-400">Host</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isAgentOnly && (
                  <div className="mt-3 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>
                        {isHost ? "Tú (host)" : playerName}:
                        <span className="ml-1 text-zinc-500">espectador</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {isHost && (
                <div className="mt-6 border-t border-zinc-800 pt-5">
                  <button
                    type="button"
                    onClick={openEditModal}
                    className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-emerald-500 hover:bg-zinc-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                      <path d="m15 5 3 3" />
                    </svg>
                    Editar sala
                  </button>
                  <button
                    type="button"
                    onClick={handleStartGame}
                    disabled={!canStart}
                    className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-base font-bold text-zinc-950 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400 disabled:shadow-none"
                  >
                    Empezar partida
                  </button>
                  {!canStart && (
                    <p className="mt-2 text-center text-xs text-zinc-500">
                      {isAgentOnly
                        ? "Se necesitan al menos 2 agentes para empezar."
                        : "Se necesitan al menos 2 participantes para empezar."}
                    </p>
                  )}
                </div>
              )}

              {!isHost && (
                <p className="mt-4 text-center text-xs text-zinc-500">
                  {lateWaiting
                    ? "El juego está en curso. Espera a que termine."
                    : "Esperando a que el host empiece la partida."}
                </p>
              )}

              <div className="mt-4 text-center">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-emerald-400"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  Volver al inicio
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {game.phase !== "lobby" && (
        <>
          <GameUI
        game={game}
        phaseTimeLeft={phaseTimeLeft}
        isLocalDrawer={isDrawer}
        currentDrawerName={currentDrawer?.name || ""}
        onEndRoundEarly={handleEndRoundEarly}
      />

      {game.phase === "choosing" && isDrawer && (
        <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-zinc-950/95 px-5 py-10 backdrop-blur-sm">
          <div className="w-full max-w-5xl">
            <div className="mb-8 flex flex-col gap-6 border-b border-zinc-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">
                  Tu turno de dibujar
                </p>
                <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                  Elige una empresa para dibujar
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                  Selecciona una opción antes de que termine el tiempo. Después tendrás que representarla en el lienzo.
                </p>
              </div>

              <div
                className="flex w-fit shrink-0 items-baseline gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-3"
                aria-label={`${phaseTimeLeft} segundos restantes`}
              >
                <span className="text-4xl font-black tabular-nums text-emerald-300">
                  {phaseTimeLeft}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                  segundos
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {game.wordsForRound.map((word, index) => (
                <button
                  type="button"
                  key={word}
                  onClick={() => handleChooseWord(word)}
                  className="group flex min-h-44 flex-col justify-between rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-left shadow-xl transition duration-200 hover:-translate-y-1 hover:border-emerald-400 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 active:translate-y-0"
                >
                  <span className="text-xs font-bold tracking-[0.2em] text-zinc-600 transition-colors group-hover:text-emerald-500">
                    OPCIÓN {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="my-8 flex items-center gap-4">
                    <CompanyLogo company={word} />
                    <span className="text-2xl font-bold text-white sm:text-3xl">
                      {word}
                    </span>
                  </span>
                  <span className="flex items-center justify-between border-t border-zinc-800 pt-4 text-sm font-semibold text-zinc-400 transition-colors group-hover:text-emerald-300">
                    Seleccionar
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="m13 6 6 6-6 6" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="shrink-0 text-emerald-400"
                aria-hidden="true"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>
                Esta elección es privada: solo tú, como dibujante, puedes ver estas opciones.
              </span>
            </div>
          </div>
        </div>
      )}

      {game.phase === "choosing" && !isDrawer && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70">
          <p className="text-lg">{currentDrawer?.name} está eligiendo palabra…</p>
          <p className="mt-2 text-sm text-zinc-300">Tiempo: {phaseTimeLeft}s</p>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex flex-1 flex-col">
          <div className="flex-1">
            <GameCanvas
              strokes={localStrokes}
              isDrawing={isDrawer && game.phase === "drawing"}
              onStroke={handleStroke}
              onUndo={handleUndo}
              onClear={handleClear}
            />
          </div>

          {isDrawer && game.phase === "drawing" && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
              Dibuja: <span className="text-emerald-300">{chosenWord || game.roundState?.word}</span>
            </div>
          )}
        </div>

        <div className="w-80 border-l border-zinc-800 bg-zinc-900">
          <ChatPanel
            messages={messages}
            players={game.players}
            scores={game.scores}
            onSend={handleSendGuess}
            canGuess={!isDrawer && game.phase === "drawing"}
          />
        </div>
      </div>

      {game.phase === "roundResult" && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80">
          <h2 className="mb-2 text-3xl font-bold">Fin de ronda</h2>
          <p className="mb-6 text-lg">La palabra era: <span className="font-bold text-emerald-400">{game.roundState?.word}</span></p>
          <div className="flex gap-6">
            {game.players.map((p) => (
              <div key={p.id} className="rounded-xl bg-zinc-800 px-6 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-sm text-zinc-400">
                  <PlayerAvatar avatar={p.avatar} />
                  <span>
                    {p.name} {playerKindBadge(p.kind)}
                  </span>
                </div>
                <div className="text-2xl font-bold">{game.scores[p.id] || 0}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-zinc-400">Siguiente ronda en {phaseTimeLeft}s…</p>
        </div>
      )}

      {game.phase === "gameOver" && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
          <h2 className="mb-4 text-4xl font-extrabold">Partida terminada</h2>
          <div className="mb-8 flex gap-6">
            {game.players.map((p) => (
              <div key={p.id} className={`rounded-xl px-8 py-4 text-center ${p.id === game.winnerId ? "bg-emerald-600" : "bg-zinc-800"}`}>
                <div className="flex items-center justify-center gap-1.5 text-sm">
                  {p.id === game.winnerId ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M4 22h16" />
                      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                  ) : null}
                  <PlayerAvatar avatar={p.avatar} />
                  <span>
                    {p.name} {playerKindBadge(p.kind)}
                  </span>
                </div>
                <div className="text-3xl font-bold">{game.scores[p.id] || 0}</div>
              </div>
            ))}
          </div>
          <button
            onClick={handleNewGame}
            className="rounded-lg bg-emerald-500 px-8 py-3 text-lg font-semibold text-white transition-transform active:scale-[0.98] hover:bg-emerald-400"
          >
            Nueva partida
          </button>
        </div>
      )}
        </>
      )}
    </div>
  );
}

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
  makeHumanPlayer,
  DRAWER_GUESS_BONUS,
} from "@/lib/gameLogic";
import {
  buildRoomSnapshot,
  isSnapshotDirectedTo,
  applyRoomSnapshot,
  selectSnapshotRequester,
  createJoinRetryState,
  createSnapshotRetryState,
  shouldRetryJoinRequest,
  shouldRetrySnapshotRequest,
} from "@/lib/roomSnapshotProtocol";
import { petdexSpriteSrc } from "@/lib/petdexImage";
import { playPetdexSound } from "@/lib/petdexSound";
import {
  PortalBridge,
  usePortal,
  useRegisterPortalEventHandler,
} from "@/components/PortalBridge";
import GameCanvas from "@/components/GameCanvas";
import ChatPanel from "@/components/ChatPanel";
import GameUI from "@/components/GameUI";

const FONT_DISPLAY =
  "var(--font-space-mono), Space Mono, ui-monospace, monospace";
const FONT_BODY =
  "var(--font-dm-sans), DM Sans, system-ui, sans-serif";

function SpriteLoading() {
  return (
    <span className="flex h-full w-full items-center justify-center">
      <svg
        aria-hidden="true"
        className="h-2/3 w-2/3 animate-spin text-[#6B6B62]"
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
      className="relative block h-6 w-6 shrink-0 overflow-hidden border-2 border-[#111111] text-center text-[10px] font-bold leading-[1.4rem] text-white"
      style={{ backgroundColor: avatar.dominantColor || "#3FC9B6", borderRadius: "6px", fontFamily: FONT_DISPLAY }}
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
    left.humanCount === right.humanCount &&
    left.roundCount === right.roundCount &&
    left.drawTimeSeconds === right.drawTimeSeconds &&
    left.lateJoin === right.lateJoin &&
    left.logoCollections.join(",") === right.logoCollections.join(",")
  );
}

const TRY_ELEMENTS_LOGOS: Record<string, string> = {
  vercel: "https://tryelements.dev/r/svg/vercel-logo.svg",
  supabase: "https://tryelements.dev/r/svg/supabase-logo.svg",
  obsidian: "https://tryelements.dev/r/svg/obsidian-logo.svg",
};

function CompanyLogo({ company }: { company: string }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = TRY_ELEMENTS_LOGOS[company.toLowerCase()];

  if (!logoUrl || failed) {
    return (
      <span
        role="img"
        aria-label={`Logo de ${company} no disponible`}
        className="flex h-14 w-14 items-center justify-center border-2 border-[#111111] bg-[#E7E2D4] text-[14px] font-bold text-[#111111]"
        style={{ borderRadius: "6px", fontFamily: FONT_DISPLAY }}
      >
        {company.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className="flex h-14 w-14 items-center justify-center border-2 border-[#111111] bg-[#FFFDF7] p-2"
      style={{ borderRadius: "6px", boxShadow: "3px 3px 0 #111111" }}
    >
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
        playerKind: "human",
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
    if (!isHost) {
      return { ...initial, players: [], scores: {} };
    }
    return initial;
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
    humanCount: number;
    roundCount: number;
    drawTimeSeconds: number;
    lateJoin: LateJoinPolicy;
  }>({
    humanCount: roomConfig.humanCount,
    roundCount: roomConfig.roundCount,
    drawTimeSeconds: roomConfig.drawTimeSeconds,
    lateJoin: roomConfig.lateJoin,
  });
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimeRef = useRef(0);
  const gameRef = useRef(game);
  const joinRetryRef = useRef(createJoinRetryState());
  const lastLobbySyncSignatureRef = useRef<string | null>(null);
  const pendingJoinsRef = useRef(new Set<string>());
  const lastSeenRef = useRef(new Map<string, number>());
  const pruneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const usedWordsRef = useRef(new Set<string>());
  // Player ids that already earned the drawer bonus for the current round, so
  // duplicate correct guesses never grant it twice to the same guesser.
  const drawerBonusAwardedRef = useRef(new Set<string>());
  const playedCorrectGuessSoundIdsRef = useRef(new Set<string>());
  const playedRoundCompletionSoundIdsRef = useRef(new Set<string>());
  const lastSnapshotRequestIdRef = useRef<string | null>(null);
  const lastSnapshotResponseIdRef = useRef<string | null>(null);
  const snapshotRetryRef = useRef(createSnapshotRetryState());
  // Latest identity values. The guest retry loop must read the most recent
  // playerName/avatar without re-mounting its interval whenever those props
  // change; otherwise an avatar swap or a name tweak would reset the retry
  // counter and exhaust the bounded budget on every render.
  const playerNameRef = useRef(playerName);
  const avatarRef = useRef(avatar);
  gameRef.current = game;
  playerNameRef.current = playerName;
  avatarRef.current = avatar;

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
          const guessSoundId = event.eventId || `${g.roundState?.startedAt || "round"}:${guesser.id}:${event.payload.content}`;
          if (!playedCorrectGuessSoundIdsRef.current.has(guessSoundId)) {
            playedCorrectGuessSoundIdsRef.current.add(guessSoundId);
            playPetdexSound(guesser.avatar);
          }
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
        const roundSoundId = `${g.roundState?.startedAt || event.eventId || "round"}:${g.roundState?.drawerId || "drawer"}`;
        if (!playedRoundCompletionSoundIdsRef.current.has(roundSoundId)) {
          playedRoundCompletionSoundIdsRef.current.add(roundSoundId);
          const drawer = g.players.find((player) => player.id === g.roundState?.drawerId);
          playPetdexSound(drawer?.avatar);
        }
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
          if (g.roomConfig.lateJoin === "closed") {
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
        if (!alreadyPresent && isHuman) {
          if (g.players.length + pendingJoinsRef.current.size >= g.roomConfig.humanCount) {
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
        // Identity contract: the host must address the snapshot to the guest's
        // local player id (carried in payload.requesterId), NOT to Portal's
        // anonymous senderId. Portal's senderId does not correspond to any
        // app-level identity, so using it as targetPlayerId would make the
        // guest's localPlayerId filter reject every snapshot and the guest
        // would never see a roster. Only a validated, non-empty
        // payload.requesterId can be trusted.
        const validated = selectSnapshotRequester(event.payload);
        if (!validated) break;
        // Broadcast a snapshot correlated by requestId + targetPlayerId.
        // Every connected client receives it, but only the requesting guest
        // applies the payload. This avoids Portal unicast rejection of
        // anonymous recipients and never leaks the secret word or choices.
        const snapshot = buildRoomSnapshot(
          g,
          { requestId: validated.requestId, targetPlayerId: validated.requesterId },
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

  // Guest join/snapshot recovery: bounded, repeatable after every connect.
  // Retries every 2s up to 5 attempts until the local player is present in
  // the host's roster and a matching snapshot has been acknowledged. State lives
  // in refs so the interval never causes a React update loop.
  useEffect(() => {
    if (isHost || !portal.connected) return;
    const tick = () => {
      const now = Date.now();
      const hasRosterEntry = gameRef.current.players.some((p) => p.id === localPlayerId);

      if (shouldRetryJoinRequest(joinRetryRef.current, now, { hasRosterEntry })) {
        joinRetryRef.current.attempts++;
        joinRetryRef.current.lastAttemptAt = now;
        const localPlayer = makeHumanPlayer(
          localPlayerId,
          playerNameRef.current,
          avatarRef.current
        );
        portalRef.current.send({
          type: "playerJoin",
          payload: { player: localPlayer },
        });
      }

      if (
        shouldRetrySnapshotRequest(snapshotRetryRef.current, now, {
          lastRequestId: lastSnapshotRequestIdRef.current,
          lastResponseId: lastSnapshotResponseIdRef.current,
          hasRosterEntry,
        })
      ) {
        snapshotRetryRef.current.attempts++;
        snapshotRetryRef.current.lastAttemptAt = now;
        const requestId =
          globalThis.crypto?.randomUUID?.() ||
          `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        lastSnapshotRequestIdRef.current = requestId;
        portalRef.current.send({
          type: "roomSnapshotRequest",
          payload: { requesterId: localPlayerId, requestId },
        });
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // playerName and avatar are intentionally NOT in the dep list: the loop
    // reads them from refs so an identity change does not restart the
    // bounded retry counter. localPlayerId and isHost still warrant a
    // remount because they change the loop's identity (different room or
    // host flip).
  }, [isHost, portal.connected, localPlayerId]);

  // Reset snapshot tracking and retry state on disconnect so a reconnection
  // triggers a fresh request/response pair and never applies a stale snapshot.
  useEffect(() => {
    if (!portal.connected) {
      lastSnapshotRequestIdRef.current = null;
      lastSnapshotResponseIdRef.current = null;
      joinRetryRef.current = createJoinRetryState();
      snapshotRetryRef.current = createSnapshotRetryState();
    }
  }, [portal.connected]);

  // Non-host humans announce liveness to the host: once on Portal readiness
  // and then every HEARTBEAT_INTERVAL_MS while the lobby is open. The host
  // uses these heartbeats to prune silent humans.
  useEffect(() => {
    if (isHost || game.phase !== "lobby") return;
    if (!portal.connected) return;
    const sendHeartbeat = () => {
      portalRef.current.send({ type: "playerHeartbeat", payload: { playerId: localPlayerId } });
    };
    sendHeartbeat();
    const heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(heartbeatTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, game.phase, portal.connected, localPlayerId]);

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
      portalRef.current.send({ type: "playerLeave", payload: { playerId: localPlayerId } });
    };
  }, [localPlayerId]);

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
    if (game.players.length < 2) return;
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
      humanCount: cfg.humanCount,
      roundCount: cfg.roundCount,
      drawTimeSeconds: cfg.drawTimeSeconds,
      lateJoin: cfg.lateJoin,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveRoomConfig = () => {
    if (!isHost || game.phase !== "lobby") return;
    const newConfig: RoomConfig = {
      humanCount: editDraft.humanCount,
      roundCount: editDraft.roundCount,
      drawTimeSeconds: editDraft.drawTimeSeconds,
      lateJoin: editDraft.lateJoin,
      logoCollections: gameRef.current.roomConfig.logoCollections,
    };
    setGame((prev) => {
      const humans = prev.players.filter((p) => p.kind === "human");
      const scores: Record<string, number> = {};
      for (const p of humans) {
        scores[p.id] = prev.scores[p.id] || 0;
      }
      return { ...prev, roomConfig: newConfig, players: humans, scores };
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



  // Shared button style: rectangular, 2px black border, hard offset shadow,
  // active press drops the shadow. All copy is Space Mono uppercase.
  const primaryBtn =
    "border-2 border-[#111111] bg-[#7EB6FF] px-4 py-3 text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111] shadow-[5px_5px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:border-[#111111] disabled:bg-[#E7E2D4] disabled:text-[#6B6B62] disabled:shadow-none";
  const secondaryBtn =
    "border-2 border-[#111111] bg-[#FFFDF7] px-4 py-2.5 text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111] shadow-[5px_5px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";
  const labelMuted =
    "text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6B62]";
  const cardShell =
    "border-2 border-[#111111] bg-[#FFFDF7] shadow-[8px_8px_0_#111111]";

  if (roomFull) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#E7E2D4] px-4 py-10 text-[#111111]">
        <section
          className={`w-full max-w-md ${cardShell} overflow-hidden`}
          style={{ borderRadius: "14px" }}
        >
          <div className="border-b-2 border-[#111111] bg-[#F26B4E] px-5 py-3">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em] text-white"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Sala llena
            </span>
          </div>
          <div className="px-6 py-7 text-center sm:px-8 sm:py-8">
            <h1
              className="text-[26px] font-bold uppercase tracking-[0.04em] text-[#111111] sm:text-[32px]"
              style={{ fontFamily: FONT_DISPLAY, lineHeight: 1.1 }}
            >
              La sala está llena
            </h1>
            <p
              className="mt-3 text-[14px] leading-[1.6] text-[#6B6B62] sm:text-[15px]"
              style={{ fontFamily: FONT_BODY }}
            >
              El host ya alcanzó el límite de jugadores humanos para esta sala.
            </p>
            <Link
              href="/"
              className={`mt-6 inline-flex items-center justify-center gap-2 ${primaryBtn}`}
              style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
            >
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
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (roomClosed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#E7E2D4] px-4 py-10 text-[#111111]">
        <section
          className={`w-full max-w-md ${cardShell} overflow-hidden`}
          style={{ borderRadius: "14px" }}
        >
          <div className="border-b-2 border-[#111111] bg-[#111111] px-5 py-3">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.08em] text-white"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Sala cerrada
            </span>
          </div>
          <div className="px-6 py-7 text-center sm:px-8 sm:py-8">
            <h1
              className="text-[26px] font-bold uppercase tracking-[0.04em] text-[#111111] sm:text-[32px]"
              style={{ fontFamily: FONT_DISPLAY, lineHeight: 1.1 }}
            >
              La sala está cerrada
            </h1>
            <p
              className="mt-3 text-[14px] leading-[1.6] text-[#6B6B62] sm:text-[15px]"
              style={{ fontFamily: FONT_BODY }}
            >
              La partida ya comenzó y la sala no admite espectadores.
            </p>
            <Link
              href="/"
              className={`mt-6 inline-flex items-center justify-center gap-2 ${primaryBtn}`}
              style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
            >
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
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Volver al inicio
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#E7E2D4] text-[#111111]"
      style={{ fontFamily: FONT_BODY }}
    >
      {isEditModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#111111]/60 px-4 py-10">
          <div
            className={`w-full max-w-md ${cardShell} overflow-hidden`}
            style={{ borderRadius: "14px" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-room-title"
          >
            <div className="flex items-center justify-between border-b-2 border-[#111111] bg-[#6FA8F5] px-5 py-3">
              <h2
                id="edit-room-title"
                className="text-[14px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                style={{ fontFamily: FONT_DISPLAY }}
              >
                Editar sala
              </h2>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="border-2 border-[#111111] bg-[#FFFDF7] p-1 text-[#111111] transition hover:bg-[#E7E2D4]"
                style={{ borderRadius: "6px" }}
                aria-label="Cerrar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5">
              <div className="mb-4">
                <label className={`mb-2 block ${labelMuted}`} style={{ fontFamily: FONT_DISPLAY }}>
                  Capacidad
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 4, 6, 8].map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setEditDraft((d) => ({ ...d, humanCount: cap }))}
                      className={`border-2 border-[#111111] px-2 py-2 text-[13px] font-bold uppercase tracking-[0.06em] transition ${editDraft.humanCount === cap ? "bg-[#7EB6FF] text-[#111111] shadow-[3px_3px_0_#111111]" : "bg-[#FFFDF7] text-[#111111] hover:bg-[#E7E2D4]"}`}
                      style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
                {editDraft.humanCount < game.players.length && (
                  <p className="mt-2 text-[12px] text-[#F26B4E]" style={{ fontFamily: FONT_BODY }}>
                    La capacidad no puede ser menor que los jugadores actuales ({game.players.length}).
                  </p>
                )}
              </div>

              <div className="mb-4">
                <label className={`mb-2 block ${labelMuted}`} style={{ fontFamily: FONT_DISPLAY }}>
                  Rondas
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[3, 4, 5].map((rounds) => (
                    <button
                      key={rounds}
                      type="button"
                      onClick={() => setEditDraft((d) => ({ ...d, roundCount: rounds }))}
                      className={`border-2 border-[#111111] px-2 py-2 text-[13px] font-bold uppercase tracking-[0.06em] transition ${editDraft.roundCount === rounds ? "bg-[#7EB6FF] text-[#111111] shadow-[3px_3px_0_#111111]" : "bg-[#FFFDF7] text-[#111111] hover:bg-[#E7E2D4]"}`}
                      style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                    >
                      {rounds}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className={`mb-2 block ${labelMuted}`} style={{ fontFamily: FONT_DISPLAY }}>
                  Tiempo de dibujo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[45, 60, 90].map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      onClick={() => setEditDraft((d) => ({ ...d, drawTimeSeconds: seconds }))}
                      className={`border-2 border-[#111111] px-2 py-2 text-[13px] font-bold uppercase tracking-[0.06em] transition ${editDraft.drawTimeSeconds === seconds ? "bg-[#7EB6FF] text-[#111111] shadow-[3px_3px_0_#111111]" : "bg-[#FFFDF7] text-[#111111] hover:bg-[#E7E2D4]"}`}
                      style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                    >
                      {seconds}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className={`mb-2 block ${labelMuted}`} style={{ fontFamily: FONT_DISPLAY }}>
                  Entrada tardía
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditDraft((d) => ({ ...d, lateJoin: "spectator" }))}
                    className={`border-2 border-[#111111] px-2 py-2 text-[13px] font-bold uppercase tracking-[0.06em] transition ${editDraft.lateJoin === "spectator" ? "bg-[#7EB6FF] text-[#111111] shadow-[3px_3px_0_#111111]" : "bg-[#FFFDF7] text-[#111111] hover:bg-[#E7E2D4]"}`}
                    style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                  >
                    Espectador
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditDraft((d) => ({ ...d, lateJoin: "closed" }))}
                    className={`border-2 border-[#111111] px-2 py-2 text-[13px] font-bold uppercase tracking-[0.06em] transition ${editDraft.lateJoin === "closed" ? "bg-[#7EB6FF] text-[#111111] shadow-[3px_3px_0_#111111]" : "bg-[#FFFDF7] text-[#111111] hover:bg-[#E7E2D4]"}`}
                    style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                  >
                    Cerrada
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className={`${secondaryBtn} flex-1`}
                  style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRoomConfig}
                  disabled={editDraft.humanCount < game.players.length}
                  className={`${primaryBtn} flex-1`}
                  style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {game.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:py-10">
          <div className="w-full max-w-lg">
            <div className="mb-5 text-center sm:mb-6">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                <span
                  className="border-2 border-[#111111] bg-[#F5D033] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  Sala pública
                </span>
              </div>
              <h1
                className="text-[28px] font-bold uppercase tracking-[0.02em] text-[#111111] sm:text-[34px]"
                style={{ fontFamily: FONT_DISPLAY, lineHeight: 1.1 }}
              >
                Sala de espera
              </h1>
              <p
                className="mx-auto mt-2 max-w-md text-[14px] leading-[1.5] text-[#6B6B62] sm:text-[15px]"
                style={{ fontFamily: FONT_BODY }}
              >
                Esperando jugadores para empezar la partida.
              </p>
            </div>

            <div
              className={`${cardShell} overflow-hidden`}
              style={{ borderRadius: "14px" }}
            >
              <div className="border-b-2 border-[#111111] bg-[#6FA8F5] px-5 py-3">
                <span
                  className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  Código de sala
                </span>
              </div>
              <div className="px-5 py-5 sm:px-6 sm:py-6">
                <div className="text-center">
                  <div
                    className="text-[32px] font-bold text-[#111111] sm:text-[38px]"
                    style={{ fontFamily: FONT_DISPLAY, letterSpacing: "0.12em", lineHeight: 1 }}
                  >
                    {roomId.toUpperCase()}
                  </div>
                </div>

                <div className="mt-5 grid gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(roomId.toUpperCase());
                      if (ok) {
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 2000);
                      }
                    }}
                    className={`${secondaryBtn} inline-flex items-center justify-center gap-2`}
                    style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                  >
                    {copiedCode ? (
                      <>
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
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        Copiado
                      </>
                    ) : (
                      <>
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
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                        Copiar código
                      </>
                    )}
                  </button>
                </div>

                {lateWaiting && (
                  <div
                    className="mt-5 border-2 border-dashed border-[#111111] bg-[#FFFDF7] px-3 py-2.5 text-[13px] text-[#111111]"
                    style={{ borderRadius: "6px", fontFamily: FONT_BODY }}
                  >
                    La partida ya comenzó. Puedes esperar a que termine para unirte.
                  </div>
                )}

                <div className="mt-5 border-t-2 border-[#111111] pt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`${labelMuted}`}
                      style={{ fontFamily: FONT_DISPLAY }}
                    >
                      Roster
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="border-2 border-[#111111] bg-[#FFFDF7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                        style={{ fontFamily: FONT_DISPLAY }}
                      >
                        {totalSeats} / {game.roomConfig.humanCount} jugadores
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {game.players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 border-2 border-[#111111] bg-[#FFFDF7] px-3 py-2.5"
                        style={{ borderRadius: "6px" }}
                      >
                        <PlayerAvatar avatar={p.avatar} />
                        <div className="min-w-0 flex-1">
                          <div
                            className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-[0.04em] text-[#111111]"
                            style={{ fontFamily: FONT_DISPLAY }}
                          >
                            <span className="truncate">{p.name}</span>
                          </div>
                          {p.id === localPlayerId && (
                            <div className="text-[11px] text-[#6B6B62]" style={{ fontFamily: FONT_BODY }}>
                              Tú
                            </div>
                          )}
                          {p.id === game.hostId && p.id !== localPlayerId && (
                            <div className="text-[11px] text-[#F26B4E]" style={{ fontFamily: FONT_BODY }}>
                              Host
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>


                </div>

                {isHost && (
                  <div className="mt-6 border-t-2 border-[#111111] pt-5">
                    <button
                      type="button"
                      onClick={openEditModal}
                      className={`${secondaryBtn} mb-3 inline-flex w-full items-center justify-center gap-2`}
                      style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                    >
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
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 3 3" />
                      </svg>
                      Editar sala
                    </button>
                    <button
                      type="button"
                      onClick={handleStartGame}
                      disabled={!canStart}
                      className={`${primaryBtn} w-full`}
                      style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                    >
                      Empezar partida
                    </button>
                    {!canStart && (
                      <p
                        className="mt-2 text-center text-[12px] text-[#6B6B62]"
                        style={{ fontFamily: FONT_BODY }}
                      >
                        Se necesitan al menos 2 jugadores para empezar.
                      </p>
                    )}
                  </div>
                )}

                {!isHost && (
                  <p
                    className="mt-4 text-center text-[12px] text-[#6B6B62]"
                    style={{ fontFamily: FONT_BODY }}
                  >
                    {lateWaiting
                      ? "El juego está en curso. Espera a que termine."
                      : "Esperando a que el host empiece la partida."}
                  </p>
                )}

                <div className="mt-4 text-center">
                  <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#111111] transition hover:text-[#7EB6FF]"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                    Volver al inicio
                  </Link>
                </div>
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
            <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#6FA8F5]/95 px-4 py-8 sm:px-5 sm:py-10">
              <div className="w-full max-w-5xl">
                <div
                  className={`${cardShell} overflow-hidden`}
                  style={{ borderRadius: "14px" }}
                >
                  <div className="border-b-2 border-[#111111] bg-[#6FA8F5] px-5 py-3 sm:px-6">
                    <span
                      className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                      style={{ fontFamily: FONT_DISPLAY }}
                    >
                      Tu turno de dibujar
                    </span>
                  </div>
                  <div className="px-5 py-5 sm:px-6 sm:py-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="max-w-2xl">
                        <h2
                          className="text-[26px] font-bold uppercase tracking-[0.02em] text-[#111111] sm:text-[32px]"
                          style={{ fontFamily: FONT_DISPLAY, lineHeight: 1.1 }}
                        >
                          Elige una empresa para dibujar
                        </h2>
                        <p
                          className="mt-2 max-w-xl text-[14px] leading-[1.5] text-[#6B6B62] sm:text-[15px]"
                          style={{ fontFamily: FONT_BODY }}
                        >
                          Selecciona una opción antes de que termine el tiempo. Después tendrás que representarla en el lienzo.
                        </p>
                      </div>
                      <div
                        className="flex w-fit shrink-0 items-baseline gap-2 border-2 border-[#111111] bg-[#F5D033] px-4 py-2.5"
                        style={{ borderRadius: "6px", boxShadow: "3px 3px 0 #111111" }}
                        aria-label={`${phaseTimeLeft} segundos restantes`}
                      >
                        <span
                          className="text-[28px] font-bold text-[#111111] sm:text-[34px]"
                          style={{ fontFamily: FONT_DISPLAY, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
                        >
                          {phaseTimeLeft}
                        </span>
                        <span
                          className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                          style={{ fontFamily: FONT_DISPLAY }}
                        >
                          Segundos
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                      {game.wordsForRound.map((word, index) => {
                        const barColors = ["bg-[#7EB6FF]", "bg-[#3FC9B6]", "bg-[#F26B4E]"];
                        const bar = barColors[index % barColors.length];
                        return (
                          <button
                            type="button"
                            key={word}
                            onClick={() => handleChooseWord(word)}
                            className="group flex min-h-44 flex-col border-2 border-[#111111] bg-[#FFFDF7] text-left transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                            style={{ borderRadius: "0", boxShadow: "5px 5px 0 #111111" }}
                          >
                            <span
                              className={`${bar} border-b-2 border-[#111111] px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#111111]`}
                              style={{ fontFamily: FONT_DISPLAY }}
                            >
                              Opción {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="flex flex-1 flex-col items-start justify-center gap-3 px-4 py-5">
                              <CompanyLogo company={word} />
                              <span
                                className="text-[20px] font-bold uppercase tracking-[0.04em] text-[#111111] sm:text-[24px]"
                                style={{ fontFamily: FONT_DISPLAY }}
                              >
                                {word}
                              </span>
                            </span>
                            <span
                              className="flex items-center justify-between border-t-2 border-[#111111] px-4 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-[#111111] group-hover:text-[#7EB6FF]"
                              style={{ fontFamily: FONT_DISPLAY }}
                            >
                              Seleccionar
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
                                <path d="M5 12h14" />
                                <path d="m13 6 6 6-6 6" />
                              </svg>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div
                      className="mt-5 flex items-start gap-3 border-2 border-dashed border-[#111111] bg-[#FFFDF7] px-4 py-3 text-[13px] text-[#111111]"
                      style={{ borderRadius: "6px", fontFamily: FONT_BODY }}
                    >
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
                        className="mt-0.5 shrink-0 text-[#111111]"
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
              </div>
            </div>
          )}

          {game.phase === "choosing" && !isDrawer && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#6FA8F5]/95 px-4">
              <div
                className={`${cardShell} w-full max-w-sm px-6 py-7 text-center`}
                style={{ borderRadius: "14px" }}
              >
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  Eligiendo palabra
                </p>
                <p
                  className="mt-3 text-[20px] font-bold uppercase tracking-[0.04em] text-[#111111] sm:text-[24px]"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  {currentDrawer?.name || "El dibujante"}
                </p>
                <div
                  className="mx-auto mt-5 flex w-fit items-baseline gap-2 border-2 border-[#111111] bg-[#F5D033] px-4 py-2"
                  style={{ borderRadius: "6px", boxShadow: "3px 3px 0 #111111" }}
                >
                  <span
                    className="text-[24px] font-bold text-[#111111]"
                    style={{ fontFamily: FONT_DISPLAY, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}
                  >
                    {phaseTimeLeft}
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    Segundos
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
            <div className="relative flex min-h-0 flex-1 flex-col">
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
                <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 border-2 border-[#111111] bg-[#FFFDF7] px-4 py-2"
                  style={{ borderRadius: "6px", boxShadow: "3px 3px 0 #111111" }}
                >
                  <span
                    className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    Dibuja: <span className="text-[#7EB6FF]">{chosenWord || game.roundState?.word}</span>
                  </span>
                </div>
              )}
            </div>

            <div
              className="flex w-full shrink-0 border-t-2 border-[#111111] bg-[#FFFDF7] md:w-80 md:border-l-2 md:border-t-0"
              style={{ minHeight: "260px" }}
            >
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
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#E7E2D4]/95 px-4 py-8">
              <div
                className={`${cardShell} w-full max-w-3xl overflow-hidden`}
                style={{ borderRadius: "14px" }}
              >
                <div className="border-b-2 border-[#111111] bg-[#6FA8F5] px-5 py-3 text-center sm:text-left">
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    Fin de ronda
                  </span>
                </div>
                <div className="px-5 py-5 sm:px-6 sm:py-6">
                  <p
                    className="text-center text-[15px] text-[#111111] sm:text-[16px]"
                    style={{ fontFamily: FONT_BODY }}
                  >
                    La palabra era:{" "}
                    <span
                      className="ml-1 text-[18px] font-bold uppercase tracking-[0.04em] text-[#F26B4E] sm:text-[20px]"
                      style={{ fontFamily: FONT_DISPLAY }}
                    >
                      {game.roundState?.word}
                    </span>
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-4">
                    {game.players.map((p) => (
                      <div
                        key={p.id}
                        className="flex min-w-[120px] flex-col items-center border-2 border-[#111111] bg-[#FFFDF7] px-4 py-3"
                        style={{ borderRadius: "6px", boxShadow: "3px 3px 0 #111111" }}
                      >
                        <div
                          className="flex items-center justify-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                          style={{ fontFamily: FONT_DISPLAY }}
                        >
                          <PlayerAvatar avatar={p.avatar} />
                          <span className="truncate">{p.name}</span>
                        </div>
                        <div
                          className="mt-1 text-[22px] font-bold text-[#111111]"
                          style={{ fontFamily: FONT_DISPLAY }}
                        >
                          {game.scores[p.id] || 0}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p
                    className="mt-5 text-center text-[12px] font-bold uppercase tracking-[0.08em] text-[#6B6B62]"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    Siguiente ronda en {phaseTimeLeft}s
                  </p>
                </div>
              </div>
            </div>
          )}

          {game.phase === "gameOver" && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#E7E2D4]/95 px-4 py-8">
              <div
                className={`${cardShell} w-full max-w-3xl overflow-hidden`}
                style={{ borderRadius: "14px" }}
              >
                <div className="border-b-2 border-[#111111] bg-[#F5D033] px-5 py-3 text-center sm:text-left">
                  <span
                    className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    Partida terminada
                  </span>
                </div>
                <div className="px-5 py-6 sm:px-6 sm:py-7">
                  <h2
                    className="text-center text-[24px] font-bold uppercase tracking-[0.02em] text-[#111111] sm:text-[30px]"
                    style={{ fontFamily: FONT_DISPLAY, lineHeight: 1.1 }}
                  >
                    Ganador
                  </h2>
                  <div className="mt-5 flex flex-wrap justify-center gap-3 sm:gap-4">
                    {game.players.map((p) => {
                      const isWinner = p.id === game.winnerId;
                      return (
                        <div
                          key={p.id}
                          className={`flex min-w-[130px] flex-col items-center border-2 border-[#111111] px-4 py-3 ${isWinner ? "bg-[#F26B4E] text-white" : "bg-[#FFFDF7] text-[#111111]"}`}
                          style={{ borderRadius: "6px", boxShadow: isWinner ? "5px 5px 0 #111111" : "3px 3px 0 #111111" }}
                        >
                          <div
                            className="flex items-center justify-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.08em]"
                            style={{ fontFamily: FONT_DISPLAY }}
                          >
                            {isWinner ? (
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
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
                            <span className="truncate">{p.name}</span>
                          </div>
                          <div
                            className="mt-1 text-[24px] font-bold"
                            style={{ fontFamily: FONT_DISPLAY }}
                          >
                            {game.scores[p.id] || 0}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-7 flex justify-center">
                    <button
                      type="button"
                      onClick={handleNewGame}
                      className={`${primaryBtn}`}
                      style={{ fontFamily: FONT_DISPLAY, borderRadius: 0 }}
                    >
                      Nueva partida
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

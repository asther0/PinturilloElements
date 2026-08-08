"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameState, ChatMessage, Stroke, PortalEvent } from "@/lib/types";
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
  DRAW_TIME_SECONDS,
  CHOOSE_WORD_TIME_SECONDS,
  ROUND_RESULT_SECONDS,
  AGENT_PLAYER,
  isLocalPlayerDrawer,
  getCurrentDrawer,
} from "@/lib/gameLogic";
import {
  PortalBridge,
  usePortal,
  useRegisterPortalEventHandler,
} from "@/components/PortalBridge";
import GameCanvas from "@/components/GameCanvas";
import ChatPanel from "@/components/ChatPanel";
import GameUI from "@/components/GameUI";

export default function RoomPageClient({
  roomId,
  playerName,
}: {
  roomId: string;
  playerName: string;
}) {
  // Outer wrapper: renders the Portal provider as the outermost element so the
  // inner component (which calls usePortal + registers the event handler) is a
  // child of the provider. This is what the original code was missing.
  return (
    <PortalBridge roomId={roomId}>
      <RoomInner roomId={roomId} playerName={playerName} />
    </PortalBridge>
  );
}

function RoomInner({
  roomId,
  playerName,
}: {
  roomId: string;
  playerName: string;
}) {
  const [game, setGame] = useState<GameState>(() => createInitialState(roomId, playerName));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chosenWord, setChosenWord] = useState<string | null>(null);
  const [phaseTimeLeft, setPhaseTimeLeft] = useState(0);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimeRef = useRef(0);
  const gameRef = useRef(game);
  gameRef.current = game;

  const isDrawer = isLocalPlayerDrawer(game, game.players[0].id);
  const currentDrawer = getCurrentDrawer(game);

  // Unified event handler
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
        setChosenWord(word);
        const drawer = getCurrentDrawer(g);
        if (drawer) {
          setGame((prev) => ({
            ...prev,
            phase: "drawing",
            roundState: createRoundState(prev.currentRound, drawer.id, word),
          }));
          setMessages((prev) => [
            ...prev,
            createSystemMessage(`Ronda ${g.currentRound} de ${g.totalRounds} — ${drawer.name} dibuja`),
          ]);
        }
        break;
      }
      case "stroke": {
        setLocalStrokes((prev) => [...prev, event.payload]);
        setGame((prev) => {
          if (!prev.roundState) return prev;
          return {
            ...prev,
            roundState: {
              ...prev.roundState,
              strokes: [...prev.roundState.strokes, event.payload],
            },
          };
        });
        break;
      }
      case "guess": {
        const guesser = g.players.find((p) => p.id === event.payload.playerId);
        if (!guesser) break;
        const word = g.roundState?.word;
        const correct = word ? checkGuess(event.payload.content, word) : false;
        const msg = createChatMessage(guesser, event.payload.content, true, correct);
        setMessages((prev) => [...prev, msg]);
        if (correct && word) {
          const score = calculateGuessScore(g.roundState?.timeRemaining || 0);
          setGame((prev) => {
            const newScores = { ...prev.scores, [guesser.id]: (prev.scores[guesser.id] || 0) + score };
            return { ...prev, scores: newScores };
          });
          setMessages((prev) => [
            ...prev,
            createSystemMessage(`${guesser.name} acertó (+${score} pts)`),
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
    }
  }, []);

  // Register the event handler with the surrounding PortalBridge.
  useRegisterPortalEventHandler(handleEvent);

  // usePortal now resolves to the real provider (we are a child of PortalBridge).
  const portal = usePortal();

  // Start game when entering room
  useEffect(() => {
    const init = () => {
      portal.send({
        type: "gameStart",
        payload: { players: game.players, totalRounds: game.totalRounds },
      });
      portal.send({
        type: "chooseWord",
        payload: { words: pickThreeWords() },
      });
    };
    const t = setTimeout(init, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Phase timer (choosing / drawing / roundResult)
  useEffect(() => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);

    if (game.phase === "choosing") {
      phaseTimeRef.current = CHOOSE_WORD_TIME_SECONDS;
    } else if (game.phase === "drawing") {
      phaseTimeRef.current = DRAW_TIME_SECONDS;
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
          const word = gameRef.current.wordsForRound[0] || pickThreeWords()[0];
          portal.send({ type: "wordChosen", payload: { word } });
        } else if (gameRef.current.phase === "drawing") {
          portal.send({
            type: "roundEnd",
            payload: {
              word: gameRef.current.roundState?.word || "",
              scores: gameRef.current.scores,
            },
          });
        } else if (gameRef.current.phase === "roundResult") {
          if (shouldEndGame(gameRef.current)) {
            const winner = getWinner(gameRef.current);
            portal.send({
              type: "gameOver",
              payload: {
                winnerId: winner?.id || "",
                finalScores: gameRef.current.scores,
              },
            });
          } else {
            const next = advanceDrawer(gameRef.current);
            setGame(next);
            portal.send({
              type: "chooseWord",
              payload: { words: pickThreeWords() },
            });
          }
        }
      }
    }, 1000);

    return () => {
      if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);
    };
  }, [game.phase, portal]);

  // Agent guess logic during drawing
  useEffect(() => {
    if (game.phase !== "drawing" || !game.roundState) return;

    const word = game.roundState.word;
    const agentId = AGENT_PLAYER.id;

    const delay = 10000 + Math.random() * 30000;
    const t = setTimeout(() => {
      portal.send({
        type: "guess",
        payload: { playerId: agentId, content: word },
      });
    }, delay);

    return () => clearTimeout(t);
  }, [game.phase, game.roundState?.word, portal]);

  const handleChooseWord = (word: string) => {
    portal.send({ type: "wordChosen", payload: { word } });
  };

  const handleSendGuess = (text: string) => {
    const localId = game.players[0].id;
    portal.send({
      type: "guess",
      payload: { playerId: localId, content: text },
    });
    setMessages((prev) => [
      ...prev,
      createChatMessage(game.players[0], text, true, false),
    ]);
  };

  const handleStroke = (stroke: Stroke) => {
    portal.send({ type: "stroke", payload: stroke });
  };

  const handleEndRoundEarly = () => {
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
    const fresh = createInitialState(roomId, playerName);
    setGame(fresh);
    setTimeout(() => {
      portal.send({
        type: "gameStart",
        payload: { players: fresh.players, totalRounds: fresh.totalRounds },
      });
      portal.send({
        type: "chooseWord",
        payload: { words: pickThreeWords() },
      });
    }, 300);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-zinc-900 text-white">
      <GameUI
        game={game}
        phaseTimeLeft={phaseTimeLeft}
        isLocalDrawer={isDrawer}
        currentDrawerName={currentDrawer?.name || ""}
        onEndRoundEarly={handleEndRoundEarly}
      />

      {game.phase === "choosing" && isDrawer && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70">
          <h2 className="mb-6 text-2xl font-bold">Elige una palabra</h2>
          <div className="flex gap-4">
            {game.wordsForRound.map((w) => (
              <button
                key={w}
                onClick={() => handleChooseWord(w)}
                className="rounded-xl bg-emerald-500 px-6 py-4 text-lg font-semibold text-white transition-transform active:scale-[0.98] hover:bg-emerald-400"
              >
                {w}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-zinc-300">Tiempo: {phaseTimeLeft}s</p>
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
                <div className="text-sm text-zinc-400">{p.name}</div>
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
                <div className="text-sm">{p.name} {p.id === game.winnerId ? "🏆" : ""}</div>
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
    </div>
  );
}

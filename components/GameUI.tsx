"use client";

import { GameState } from "@/lib/types";
import { formatTime } from "@/lib/gameLogic";

export default function GameUI({
  game,
  phaseTimeLeft,
  isLocalDrawer,
  currentDrawerName,
  onEndRoundEarly,
}: {
  game: GameState;
  phaseTimeLeft: number;
  isLocalDrawer: boolean;
  currentDrawerName: string;
  onEndRoundEarly: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-semibold">
          Ronda {game.currentRound} de {game.totalRounds}
        </div>
        <div className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-semibold">
          Dibuja: <span className="text-amber-300">{currentDrawerName}</span>
        </div>
        {game.phase === "drawing" && (
          <div className={`rounded-lg px-3 py-1.5 text-sm font-bold ${phaseTimeLeft <= 10 ? "bg-rose-600 text-white" : "bg-zinc-800"}`}>
            {formatTime(phaseTimeLeft)}
          </div>
        )}
        {game.phase === "choosing" && (
          <div className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-bold">
            Eligiendo… {phaseTimeLeft}s
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isLocalDrawer && game.phase === "drawing" && (
          <button
            onClick={onEndRoundEarly}
            className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-semibold text-white transition-transform active:scale-[0.98] hover:bg-rose-400"
          >
            Terminar dibujo
          </button>
        )}
      </div>
    </div>
  );
}

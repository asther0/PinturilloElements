"use client";

import { GameState } from "@/lib/types";
import { formatTime, formatWordHint } from "@/lib/gameLogic";

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
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b-2 border-[#111111] bg-[#FFFDF7] px-4 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="border-2 border-[#111111] bg-[#E7E2D4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111] shadow-[3px_3px_0_#111111]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Ronda {game.currentRound} de {game.totalRounds}
        </div>
        <div
          className="border-2 border-[#111111] bg-[#E7E2D4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111] shadow-[3px_3px_0_#111111]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Dibuja:{" "}
          <span className="text-[#7EB6FF]">{currentDrawerName}</span>
        </div>
        {game.phase === "drawing" && (
          <>
            <div
              className={`border-2 border-[#111111] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] shadow-[3px_3px_0_#111111] ${phaseTimeLeft <= 10 ? "bg-[#F5D033] text-[#111111]" : "bg-[#E7E2D4] text-[#111111]"}`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatTime(phaseTimeLeft)}
            </div>
            {game.roundState?.word && (
              <div
                className="border-2 border-[#111111] bg-[#E7E2D4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111] shadow-[3px_3px_0_#111111]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {isLocalDrawer ? "Palabra: " : "Pista: "}
                <span className="text-[#7EB6FF]">
                  {isLocalDrawer ? game.roundState.word : formatWordHint(game.roundState.word)}
                </span>
              </div>
            )}
          </>
        )}
        {game.phase === "choosing" && (
          <div
            className="border-2 border-[#111111] bg-[#E7E2D4] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111] shadow-[3px_3px_0_#111111]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Eligiendo... {phaseTimeLeft}s
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isLocalDrawer && game.phase === "drawing" && (
          <button
            onClick={onEndRoundEarly}
            className="border-2 border-[#111111] bg-[#F26B4E] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white shadow-[3px_3px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Terminar dibujo
          </button>
        )}
      </div>
    </div>
  );
}

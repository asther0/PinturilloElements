"use client";

import { useRef, useEffect, useState } from "react";
import { ChatMessage, Player } from "@/lib/types";
import { playerKindBadge } from "@/lib/gameLogic";

export default function ChatPanel({
  messages,
  players,
  scores,
  onSend,
  canGuess,
}: {
  messages: ChatMessage[];
  players: Player[];
  scores: Record<string, number>;
  onSend: (text: string) => void;
  canGuess: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !canGuess) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Jugadores</h3>
        <div className="mt-2 flex flex-col gap-1">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className={p.kind === "room-agent" ? "text-amber-300" : p.kind === "agent-byok" ? "text-sky-300" : ""}>
                {p.name} {playerKindBadge(p.kind)}
              </span>
              <span className="font-semibold text-emerald-400">{scores[p.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.isSystem
                  ? "bg-zinc-800/60 text-zinc-300"
                  : msg.isCorrect
                  ? "bg-emerald-900/40 text-emerald-200"
                  : "bg-zinc-800 text-zinc-100"
              }`}
            >
              <div className="mb-0.5 text-xs font-semibold text-zinc-400">
                {msg.playerName} {playerKindBadge(msg.playerKind)}
              </div>
              <div>{msg.content}</div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-zinc-800 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={canGuess ? "Escribe tu guess…" : "Solo puedes adivinar cuando no dibujas"}
            disabled={!canGuess}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!canGuess || !input.trim()}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.98] hover:bg-emerald-400 disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}

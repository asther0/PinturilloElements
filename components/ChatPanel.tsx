"use client";

import { useRef, useEffect, useState } from "react";
import { ChatMessage, PetdexAvatar, Player } from "@/lib/types";
import { playerKindBadge } from "@/lib/gameLogic";

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

function AvatarThumb({ avatar, small = false }: { avatar?: PetdexAvatar; small?: boolean }) {
  const spritesheetUrl = avatar?.spritesheetUrl;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Hooks stay unconditional even when avatar is absent. Reset per-image state
  // when the spritesheet URL changes so a previous image's loading/error state
  // never leaks onto a new sprite.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [spritesheetUrl]);

  if (!avatar) return null;

  return (
    <span
      role="img"
      aria-label={avatar.displayName}
      className={`relative block shrink-0 overflow-hidden rounded-sm font-bold text-white ${
        small ? "h-4 w-4 text-[8px] leading-4" : "h-5 w-5 text-[9px] leading-5"
      }`}
      style={{ backgroundColor: avatar.dominantColor || "#3f3f46" }}
    >
      {!loaded && !failed && <SpriteLoading />}
      {failed && avatar.displayName.slice(0, 1).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden="true"
        src={avatar.spritesheetUrl}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute left-0 top-0 h-auto w-[800%] max-w-none [image-rendering:pixelated] ${failed ? "hidden" : ""}`}
      />
    </span>
  );
}

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
              <span className="flex items-center gap-1.5">
                <AvatarThumb avatar={p.avatar} />
                <span className={p.kind === "room-agent" ? "text-amber-300" : p.kind === "agent-byok" ? "text-sky-300" : ""}>
                  {p.name} {playerKindBadge(p.kind)}
                </span>
              </span>
              <span className="font-semibold text-emerald-400">{scores[p.id] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const msgPlayer = players.find((p) => p.id === msg.playerId);
            const isAgent = msg.playerKind !== "human" && !msg.isSystem;
            const messageClass = msg.isSystem
              ? "border-sky-700/50 bg-sky-950/40 text-sky-100"
              : msg.isCorrect
              ? "border-emerald-500/60 bg-emerald-950/60 text-emerald-100"
              : isAgent
              ? "border-amber-600/50 bg-amber-950/40 text-amber-100"
              : "border-zinc-700 bg-zinc-800 text-zinc-100";

            return (
              <div
                key={msg.id}
                className={`rounded-lg border px-3 py-2 text-sm ${messageClass}`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider opacity-80">
                  <AvatarThumb avatar={msgPlayer?.avatar} small />
                  <span>
                    {msg.playerName} {playerKindBadge(msg.playerKind)}
                  </span>
                  {msg.isCorrect && (
                    <span className="ml-auto text-emerald-300">Correcto</span>
                  )}
                  {isAgent && !msg.isCorrect && (
                    <span className="ml-auto text-amber-300">Agente</span>
                  )}
                </div>
                <div>{msg.content}</div>
              </div>
            );
          })}
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

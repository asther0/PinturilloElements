"use client";

import { useRef, useEffect, useState } from "react";
import { ChatMessage, PetdexAvatar, Player } from "@/lib/types";
import { petdexSpriteSrc } from "@/lib/petdexImage";

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
        src={petdexSpriteSrc(avatar.spritesheetUrl)}
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
    <div className="flex h-full flex-col bg-[#E7E2D4]">
      <div className="border-b-2 border-[#111111] bg-[#FFFDF7] px-4 py-3">
        <h3
          className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6B62]"
          style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
        >
          Jugadores
        </h3>
        <div className="mt-2 flex flex-col gap-1">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5">
                <AvatarThumb avatar={p.avatar} />
                <span
                  className="text-[#111111]"
                  style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
                >
                  {p.name}
                </span>
              </span>
              <span
                className="font-bold text-[#111111]"
                style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
              >
                {scores[p.id] || 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2">
          {messages.map((msg) => {
            const msgPlayer = players.find((p) => p.id === msg.playerId);
            const messageClass = msg.isSystem
              ? "border-[#111111] bg-[#6FA8F5] text-[#111111]"
              : msg.isCorrect
                ? "border-[#111111] bg-[#3FC9B6] text-[#111111]"
                : "border-[#111111] bg-[#FFFDF7] text-[#111111]";

            return (
              <div
                key={msg.id}
                className={`border-2 px-3 py-2 text-[13px] shadow-[3px_3px_0_#111111] ${messageClass}`}
                style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
              >
                <div
                  className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] opacity-90"
                  style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                >
                  <AvatarThumb avatar={msgPlayer?.avatar} small />
                  <span>{msg.playerName}</span>
                  {msg.isCorrect && (
                    <span className="ml-auto text-[#111111]">Correcto</span>
                  )}
                </div>
                <div>{msg.content}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t-2 border-[#111111] px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={canGuess ? "Escribe tu guess..." : "Solo puedes adivinar cuando no dibujas"}
            disabled={!canGuess}
            className="flex-1 border-2 border-[#111111] bg-[#FFFDF7] px-3 py-2 text-[13px] text-[#111111] placeholder-[#6B6B62] outline-none transition focus:shadow-[3px_3px_0_#111111] disabled:opacity-50"
            style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
          />
          <button
            type="submit"
            disabled={!canGuess || !input.trim()}
            className="border-2 border-[#111111] bg-[#7EB6FF] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111] shadow-[3px_3px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50"
            style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}

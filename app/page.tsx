"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const router = useRouter();

  const handleCreate = () => {
    const id = Math.random().toString(36).slice(2, 8);
    router.push(`/room/${id}?name=${encodeURIComponent(name || "Jugador")}`);
  };

  const handleJoin = () => {
    if (!roomId.trim()) return;
    router.push(`/room/${roomId.trim()}?name=${encodeURIComponent(name || "Jugador")}`);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <div className="inline-block rounded-full bg-rose-500 px-3 py-1 text-xs font-bold tracking-wider text-white">
        MVP INTERNO
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
        PinturilloElements
      </h1>
      <p className="max-w-md text-center text-zinc-400">
        Sala estilo Skribbl. 3 rondas, nombres tech, 60 segundos para dibujar.
        Incluye jugador agente (Bot 🤖).
      </p>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="text"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
        />
        <button
          onClick={handleCreate}
          className="rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-white transition-transform active:scale-[0.98] hover:bg-emerald-400"
        >
          Crear Sala
        </button>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="ID de sala"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleJoin}
            className="rounded-lg bg-zinc-700 px-4 py-3 font-semibold text-white transition-transform active:scale-[0.98] hover:bg-zinc-600"
          >
            Unirse
          </button>
        </div>
      </div>
    </main>
  );
}

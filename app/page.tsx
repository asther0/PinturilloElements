"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SeatOption = {
  kind: "human" | "agent-byok" | "room-agent";
  label: string;
  description: string;
};

const SEAT_OPTIONS: SeatOption[] = [
  { kind: "human", label: "Humano", description: "Jugador normal" },
  { kind: "room-agent", label: "Agente Sala", description: "Agente pagado por la sala" },
  { kind: "agent-byok", label: "Agente BYOK", description: "Trae tu propia API key" },
];

export default function HomePage() {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState<SeatOption["kind"][]>(["room-agent"]);
  const [showByokModal, setShowByokModal] = useState(false);
  const [byokConfig, setByokConfig] = useState<{
    provider: "openai";
    model: string;
    apiKey: string;
  } | null>(null);

  const router = useRouter();

  const addSeat = (kind: SeatOption["kind"]) => {
    if (kind === "agent-byok") {
      setShowByokModal(true);
    }
    setSeats((prev) => [...prev, kind]);
  };

  const removeSeat = (index: number) => {
    setSeats((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    const id = Math.random().toString(36).slice(2, 8);
    const params = new URLSearchParams();
    params.set("name", name || "Jugador");
    params.set("seats", seats.join(","));
    if (byokConfig) {
      // Only metadata goes into URL, NEVER the API key
      params.set("byokProvider", byokConfig.provider);
      params.set("byokModel", byokConfig.model);
    }
    router.push(`/room/${id}?${params.toString()}`);
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
        Incluye jugador agente (Bot).
      </p>

      <div className="flex w-full max-w-sm flex-col gap-3">
        <input
          type="text"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
        />

        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
            Asientos ({seats.length})
          </div>
          <div className="flex flex-col gap-2">
            {seats.map((kind, i) => {
              const opt = SEAT_OPTIONS.find((o) => o.kind === kind)!;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-zinc-700/50 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-400">
                      {i + 1}
                    </span>
                    <span>{opt.label}</span>
                  </div>
                  <button
                    onClick={() => removeSeat(i)}
                    className="text-xs text-rose-400 hover:text-rose-300"
                  >
                    Quitar
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {SEAT_OPTIONS.map((opt) => (
              <button
                key={opt.kind}
                onClick={() => addSeat(opt.kind)}
                className="rounded-md bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-white transition-transform active:scale-[0.98] hover:bg-zinc-600"
              >
                + {opt.label}
              </button>
            ))}
          </div>
        </div>

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

      {showByokModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-xl bg-zinc-900 p-6 shadow-2xl border border-zinc-700">
            <h2 className="mb-4 text-lg font-bold">Configurar Agente BYOK</h2>
            <p className="mb-4 flex items-start gap-1.5 text-xs text-amber-400">
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
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <span>
                Session-only: la API key se usa solo en memoria durante esta
                sesión. Nunca se guarda en URL, localStorage, eventos ni logs.
              </span>
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Proveedor
                </label>
                <select
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  value={byokConfig?.provider || "openai"}
                  onChange={(e) =>
                    setByokConfig((prev) => ({
                      provider: e.target.value as "openai",
                      model: prev?.model || "gpt-4o-mini",
                      apiKey: prev?.apiKey || "",
                    }))
                  }
                >
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  Modelo
                </label>
                <select
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
                  value={byokConfig?.model || "gpt-4o-mini"}
                  onChange={(e) =>
                    setByokConfig((prev) => ({
                      provider: prev?.provider || "openai",
                      model: e.target.value,
                      apiKey: prev?.apiKey || "",
                    }))
                  }
                >
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4o">gpt-4o</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-zinc-400">
                  API Key
                </label>
                <input
                  type="password"
                  placeholder="sk-..."
                  value={byokConfig?.apiKey || ""}
                  onChange={(e) =>
                    setByokConfig((prev) => ({
                      provider: prev?.provider || "openai",
                      model: prev?.model || "gpt-4o-mini",
                      apiKey: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-emerald-500"
                />
              </div>
              <button
                onClick={() => setShowByokModal(false)}
                className="mt-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.98] hover:bg-emerald-400"
              >
                Guardar (solo sesión)
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

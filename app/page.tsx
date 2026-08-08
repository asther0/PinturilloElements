"use client";

import { useEffect, useState } from "react";
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

type PetdexPet = {
  slug: string;
  displayName: string;
  spritesheetPath: string;
  dominantColor?: string;
};

const PETDEX_BOUND = 18;
const FALLBACK_PETS: PetdexPet[] = [
  {
    slug: "002",
    displayName: "002",
    spritesheetPath: "https://assets.petdex.dev/pets/002-5045a81e11b5/sprite.webp",
    dominantColor: "#d32f2a",
  },
  {
    slug: "01-researcher-2",
    displayName: "01-Researcher",
    spritesheetPath:
      "https://assets.petdex.dev/pets/01-researcher-437bb6984c93/sprite.webp",
    dominantColor: "#c9872a",
  },
  {
    slug: "grinny",
    displayName: "0Kai",
    spritesheetPath:
      "https://assets.petdex.dev/pets/grinny-5d3063bcef7d/sprite.webp",
    dominantColor: "#cc34ac",
  },
];

function parsePet(value: unknown): PetdexPet | null {
  if (!value || typeof value !== "object") return null;

  const pet = value as Record<string, unknown>;
  if (
    typeof pet.slug !== "string" ||
    typeof pet.spritesheetPath !== "string"
  ) {
    return null;
  }

  try {
    const spriteUrl = new URL(pet.spritesheetPath);
    if (
      spriteUrl.protocol !== "https:" ||
      spriteUrl.hostname !== "assets.petdex.dev"
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    slug: pet.slug,
    displayName:
      typeof pet.displayName === "string" ? pet.displayName : pet.slug,
    spritesheetPath: pet.spritesheetPath,
    dominantColor:
      typeof pet.dominantColor === "string" ? pet.dominantColor : undefined,
  };
}

function PetdexSprite({ pet }: { pet: PetdexPet }) {
  return (
    <span
      role="img"
      aria-label={pet.displayName}
      className="relative block aspect-[12/13] h-full max-h-full overflow-hidden rounded-sm bg-zinc-700 text-center text-xs font-bold leading-[4rem] text-white"
      style={{ backgroundColor: pet.dominantColor }}
    >
      {pet.displayName.slice(0, 1).toUpperCase()}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-left-top bg-no-repeat [background-size:800%_auto] [image-rendering:pixelated]"
        style={{ backgroundImage: `url(${JSON.stringify(pet.spritesheetPath)})` }}
      />
    </span>
  );
}

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

  const [pets, setPets] = useState<PetdexPet[]>(FALLBACK_PETS);
  const [petsLoading, setPetsLoading] = useState(true);
  const [usingFallbackPets, setUsingFallbackPets] = useState(false);
  const [selectedAvatarSlug, setSelectedAvatarSlug] = useState<string | null>(
    FALLBACK_PETS[0].slug
  );

  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    fetch(`/petdex-api/pets/search?limit=${PETDEX_BOUND}`, {
      headers: { Accept: "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Petdex responded with ${res.status}`);
        return res.json() as Promise<unknown>;
      })
      .then((data: unknown) => {
        if (cancelled) return;
        const rawPets =
          data && typeof data === "object"
            ? (data as Record<string, unknown>).pets
            : undefined;
        const list = (Array.isArray(rawPets) ? rawPets : [])
          .slice(0, PETDEX_BOUND)
          .map(parsePet)
          .filter((pet): pet is PetdexPet => pet !== null);
        if (list.length === 0) throw new Error("Petdex returned no usable pets");

        setPets(list);
        setSelectedAvatarSlug((current) =>
          list.some((pet) => pet.slug === current) ? current : list[0].slug
        );
        setUsingFallbackPets(false);
      })
      .catch(() => {
        if (!cancelled) setUsingFallbackPets(true);
      })
      .finally(() => {
        if (!cancelled) setPetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAvatar = pets.find((p) => p.slug === selectedAvatarSlug);

  const buildRoomParams = () => {
    const params = new URLSearchParams();
    params.set("name", name || "Jugador");
    params.set("seats", seats.join(","));
    if (selectedAvatar) {
      params.set("avatarSlug", selectedAvatar.slug);
      params.set("avatarDisplayName", selectedAvatar.displayName);
      params.set("avatarSpritesheet", selectedAvatar.spritesheetPath);
      if (selectedAvatar.dominantColor) {
        params.set("avatarColor", selectedAvatar.dominantColor);
      }
    }
    if (byokConfig) {
      // Only metadata goes into URL, NEVER the API key
      params.set("byokProvider", byokConfig.provider);
      params.set("byokModel", byokConfig.model);
    }
    return params;
  };

  const handleCreate = () => {
    const id = Math.random().toString(36).slice(2, 8);
    const params = buildRoomParams();
    router.push(`/room/${id}?${params.toString()}`);
  };

  const handleJoin = () => {
    if (!roomId.trim()) return;
    const params = buildRoomParams();
    router.push(`/room/${roomId.trim()}?${params.toString()}`);
  };

  const handleJoinRandom = () => {
    // Deterministic placeholder: generate a short random id.
    // Labelled accurately because no directory backend exists yet.
    const id = Math.random().toString(36).slice(2, 8);
    const params = buildRoomParams();
    router.push(`/room/${id}?${params.toString()}`);
  };

  const addSeat = (kind: SeatOption["kind"]) => {
    if (kind === "agent-byok") {
      setShowByokModal(true);
    }
    setSeats((prev) => [...prev, kind]);
  };

  const removeSeat = (index: number) => {
    setSeats((prev) => prev.filter((_, i) => i !== index));
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

        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-zinc-400">
            <span>Avatar</span>
            {petsLoading && <span className="text-zinc-500">Cargando...</span>}
            {!petsLoading && usingFallbackPets && (
              <span className="text-amber-400">Catálogo de respaldo</span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
            {pets.map((pet) => (
              <button
                type="button"
                key={pet.slug}
                onClick={() => setSelectedAvatarSlug(pet.slug)}
                title={pet.displayName}
                aria-label={`Elegir avatar ${pet.displayName}`}
                aria-pressed={selectedAvatarSlug === pet.slug}
                className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-md border-2 bg-zinc-900 p-1 transition-transform active:scale-[0.96] ${
                  selectedAvatarSlug === pet.slug
                    ? "border-emerald-400"
                    : "border-transparent hover:border-zinc-500"
                }`}
              >
                <PetdexSprite pet={pet} />
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreate}
          className="rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-white transition-transform active:scale-[0.98] hover:bg-emerald-400"
        >
          Crear Sala Publica
        </button>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Codigo de sala"
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

        <button
          onClick={handleJoinRandom}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.98] hover:bg-zinc-700"
        >
          Unirse a sala aleatoria (genera ID nuevo)
        </button>
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

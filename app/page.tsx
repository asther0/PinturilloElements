"use client";

import { useDeferredValue, useEffect, useState } from "react";
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

const PETDEX_CURATED_COUNT = 12;
const PETDEX_PAGE_SIZE = 30;
const FALLBACK_PETS: PetdexPet[] = [
  {
    slug: "nezukocoder",
    displayName: "NezukoCoder",
    spritesheetPath:
      "https://assets.petdex.dev/pets/nezukocoder-7d766f7c2597/sprite.webp",
    dominantColor: "#c65922",
  },
  {
    slug: "shinchan",
    displayName: "Shinchan",
    spritesheetPath:
      "https://assets.petdex.dev/pets/shinchan-154a84d8ff3c/sprite.webp",
    dominantColor: "#de1f1a",
  },
  {
    slug: "capvolt",
    displayName: "Pikachu",
    spritesheetPath:
      "https://assets.petdex.dev/pets/capvolt-7be64ef6cfa2/sprite.webp",
    dominantColor: "#f7d605",
  },
  {
    slug: "lulu-capybara-2",
    displayName: "Lulu Capybara",
    spritesheetPath:
      "https://assets.petdex.dev/pets/lulu-capybara-9f9107636ecc/sprite.webp",
  },
  {
    slug: "doraemon",
    displayName: "Doraemon",
    spritesheetPath:
      "https://assets.petdex.dev/pets/doraemon-58b12a5012e0/sprite.webp",
    dominantColor: "#048ae1",
  },
  {
    slug: "qqpet-codex",
    displayName: "QQpet-codex",
    spritesheetPath:
      "https://assets.petdex.dev/pets/qqpet-codex-pending-6c6a5a48a512/sprite.png",
    dominantColor: "#eb8b04",
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

  const rawDisplayName =
    typeof pet.displayName === "string" ? pet.displayName : pet.slug;
  const displayName = rawDisplayName
    .replace(/[\p{Extended_Pictographic}\p{Cf}]/gu, "")
    .trim();

  return {
    slug: pet.slug,
    displayName: displayName || pet.slug,
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
      className="relative flex aspect-[12/13] h-full max-h-full items-center justify-center overflow-hidden rounded-sm bg-zinc-700 text-center text-xs font-bold text-white"
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

type PetdexPage = {
  pets: PetdexPet[];
  nextCursor: number | null;
  total: number;
};

function parsePetdexPage(data: unknown): PetdexPage {
  const record =
    data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : {};
  const pets = (Array.isArray(record.pets) ? record.pets : [])
    .map(parsePet)
    .filter((pet): pet is PetdexPet => pet !== null);
  const nextCursor =
    typeof record.nextCursor === "number" && Number.isFinite(record.nextCursor)
      ? record.nextCursor
      : null;

  return {
    pets,
    nextCursor,
    total:
      typeof record.total === "number" && Number.isFinite(record.total)
        ? record.total
        : pets.length,
  };
}

async function fetchPetdexPage({
  query = "",
  cursor,
  signal,
  limit = PETDEX_PAGE_SIZE,
}: {
  query?: string;
  cursor?: number;
  signal?: AbortSignal;
  limit?: number;
}): Promise<PetdexPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  params.set("sort", "popular");
  if (query) params.set("q", query);
  if (cursor !== undefined) params.set("cursor", String(cursor));

  const response = await fetch(`/petdex-api/pets/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Petdex responded with ${response.status}`);
  }

  return parsePetdexPage(await response.json());
}

export default function HomePage() {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [seats, setSeats] = useState<SeatOption["kind"][]>(["room-agent"]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showByokModal, setShowByokModal] = useState(false);
  const [byokConfig, setByokConfig] = useState<{
    provider: "openai";
    model: string;
    apiKey: string;
  } | null>(null);

  const [curatedPets, setCuratedPets] = useState<PetdexPet[]>(FALLBACK_PETS);
  const [petsLoading, setPetsLoading] = useState(true);
  const [usingFallbackPets, setUsingFallbackPets] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<PetdexPet>(FALLBACK_PETS[0]);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarSearch, setAvatarSearch] = useState("");
  const [avatarResults, setAvatarResults] = useState<PetdexPet[]>(FALLBACK_PETS);
  const [avatarNextCursor, setAvatarNextCursor] = useState<number | null>(null);
  const [avatarTotal, setAvatarTotal] = useState(FALLBACK_PETS.length);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarLoadingMore, setAvatarLoadingMore] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const deferredAvatarSearch = useDeferredValue(avatarSearch.trim());

  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    fetchPetdexPage({
      limit: PETDEX_CURATED_COUNT,
      signal: controller.signal,
    })
      .then((page) => {
        if (page.pets.length === 0) {
          throw new Error("Petdex returned no usable pets");
        }

        setCuratedPets(page.pets);
        setSelectedAvatar((current) =>
          page.pets.find((pet) => pet.slug === current.slug) || page.pets[0]
        );
        setUsingFallbackPets(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setUsingFallbackPets(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPetsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!showAvatarModal) return;

    const controller = new AbortController();
    setAvatarLoading(true);
    setAvatarLoadFailed(false);
    fetchPetdexPage({
      query: deferredAvatarSearch,
      signal: controller.signal,
    })
      .then((page) => {
        if (page.pets.length === 0) {
          setAvatarResults([]);
        } else {
          setAvatarResults(page.pets);
        }
        setAvatarNextCursor(page.nextCursor);
        setAvatarTotal(page.total);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setAvatarLoadFailed(true);
          setAvatarResults((current) =>
            current.length > 0 ? current : FALLBACK_PETS
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setAvatarLoading(false);
      });

    return () => controller.abort();
  }, [deferredAvatarSearch, showAvatarModal]);

  const buildRoomParams = ({ includeSeats = false } = {}) => {
    const params = new URLSearchParams();
    params.set("name", name || "Jugador");
    if (includeSeats) params.set("seats", seats.join(","));
    if (selectedAvatar) {
      params.set("avatarSlug", selectedAvatar.slug);
      params.set("avatarDisplayName", selectedAvatar.displayName);
      params.set("avatarSpritesheet", selectedAvatar.spritesheetPath);
      if (selectedAvatar.dominantColor) {
        params.set("avatarColor", selectedAvatar.dominantColor);
      }
    }
    if (includeSeats && byokConfig) {
      // Only metadata goes into URL, NEVER the API key
      params.set("byokProvider", byokConfig.provider);
      params.set("byokModel", byokConfig.model);
    }
    return params;
  };

  const handleCreate = () => {
    const id = Math.random().toString(36).slice(2, 8);
    const params = buildRoomParams({ includeSeats: true });
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

  const handleLoadMoreAvatars = async () => {
    if (avatarNextCursor === null || avatarLoadingMore) return;

    setAvatarLoadingMore(true);
    setAvatarLoadFailed(false);
    try {
      const page = await fetchPetdexPage({
        query: deferredAvatarSearch,
        cursor: avatarNextCursor,
      });
      setAvatarResults((current) => {
        const seen = new Set(current.map((pet) => pet.slug));
        return [...current, ...page.pets.filter((pet) => !seen.has(pet.slug))];
      });
      setAvatarNextCursor(page.nextCursor);
      setAvatarTotal(page.total);
    } catch {
      setAvatarLoadFailed(true);
    } finally {
      setAvatarLoadingMore(false);
    }
  };

  const nearbyPets = curatedPets.some((pet) => pet.slug === selectedAvatar.slug)
    ? curatedPets
    : [
        selectedAvatar,
        ...curatedPets.filter((pet) => pet.slug !== selectedAvatar.slug),
      ].slice(0, PETDEX_CURATED_COUNT);

  return (
    <main className="relative flex h-screen flex-col items-center overflow-x-hidden overflow-y-auto px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.08),transparent_28%)]" />
      <section className="relative my-auto w-full max-w-xl">
        <header className="mb-7 text-center">
          <div className="mb-4 inline-block rounded-full bg-rose-500 px-3 py-1 text-xs font-bold tracking-wider text-white">
            MVP INTERNO
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            PinturilloElements
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-400 sm:text-base">
            Tres rondas para dibujar empresas tech de memoria. Entra a una sala pública y empieza a jugar.
          </p>
        </header>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-2xl backdrop-blur sm:p-6">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-400">
            Nombre del jugador
          </label>
          <input
            type="text"
            placeholder="Tu nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white placeholder-zinc-600 outline-none transition focus:border-emerald-500"
          />

          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Tu avatar Petdex
              </span>
              {petsLoading && <span className="text-xs text-zinc-500">Cargando...</span>}
              {!petsLoading && usingFallbackPets && (
                <span className="text-xs text-amber-400">Catálogo de respaldo</span>
              )}
            </div>

            <div className="mt-3 text-center">
              <div className="relative mx-auto h-20 w-20">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-2 rounded-full bg-emerald-400/20 blur-lg"
                />
                <div className="petdex-avatar-float relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-emerald-500/50 bg-zinc-900 p-1 shadow-lg shadow-emerald-950/30">
                  <PetdexSprite pet={selectedAvatar} />
                </div>
              </div>
              <div className="mt-1.5 truncate text-xs font-medium text-zinc-400">
                {selectedAvatar.displayName}
              </div>
            </div>

            <div className="mt-4">
              <div className="grid grid-cols-6 gap-1.5">
                {nearbyPets.map((pet) => (
                  <button
                    type="button"
                    key={pet.slug}
                    onClick={() => setSelectedAvatar(pet)}
                    title={pet.displayName}
                    aria-label={`Elegir avatar ${pet.displayName}`}
                    aria-pressed={selectedAvatar.slug === pet.slug}
                    className={`flex aspect-square items-center justify-center overflow-hidden rounded-lg border p-1 transition active:scale-[0.96] ${
                      selectedAvatar.slug === pet.slug
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
                    }`}
                  >
                    <PetdexSprite pet={pet} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                className="mx-auto mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-emerald-300"
              >
                Ver más avatares
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleJoinRandom}
            className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-4 text-base font-bold text-zinc-950 shadow-lg shadow-emerald-950/40 transition hover:bg-emerald-400 active:scale-[0.99]"
          >
            Unirse a sala aleatoria
          </button>

          <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-zinc-600">
            <span className="h-px flex-1 bg-zinc-800" />
            Otras opciones
            <span className="h-px flex-1 bg-zinc-800" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Código de sala"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white placeholder-zinc-600 outline-none transition focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={!roomId.trim()}
              className="rounded-xl bg-zinc-700 px-4 py-3 font-semibold text-white transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Unirse
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-3 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800 hover:text-white"
          >
            Crear sala pública
          </button>
          <p className="mt-3 text-center text-xs text-zinc-600">
            Todas las salas de este MVP son públicas.
          </p>
        </div>
      </section>

      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-dialog-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-zinc-800 p-5">
              <div>
                <h2 id="avatar-dialog-title" className="text-xl font-bold text-white">
                  Elige tu avatar Petdex
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {avatarTotal.toLocaleString("es-PE")} opciones en el catálogo público
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                aria-label="Cerrar catálogo de avatares"
                className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="border-b border-zinc-800 p-4">
              <label className="relative block">
                <span className="sr-only">Buscar avatares</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  value={avatarSearch}
                  onChange={(event) => setAvatarSearch(event.target.value)}
                  placeholder="Buscar por nombre, personaje o estilo"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3 pl-10 pr-4 text-white placeholder-zinc-600 outline-none transition focus:border-emerald-500"
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {avatarLoading ? (
                <div className="py-16 text-center text-sm text-zinc-400">Cargando catálogo Petdex...</div>
              ) : avatarResults.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="font-semibold text-zinc-200">No encontramos avatares</div>
                  <div className="mt-1 text-sm text-zinc-500">Prueba con otra búsqueda.</div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  {avatarResults.map((pet) => (
                    <button
                      type="button"
                      key={pet.slug}
                      onClick={() => {
                        setSelectedAvatar(pet);
                        setShowAvatarModal(false);
                      }}
                      aria-label={`Elegir avatar ${pet.displayName}`}
                      aria-pressed={selectedAvatar.slug === pet.slug}
                      className={`group min-w-0 rounded-xl border p-2 text-left transition hover:-translate-y-0.5 ${
                        selectedAvatar.slug === pet.slug
                          ? "border-emerald-400 bg-emerald-500/10"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                      }`}
                    >
                      <span className="mx-auto flex h-16 items-center justify-center overflow-hidden rounded-lg p-1">
                        <PetdexSprite pet={pet} />
                      </span>
                      <span className="mt-2 block truncate text-center text-[11px] font-semibold text-zinc-300 group-hover:text-white">
                        {pet.displayName}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {avatarLoadFailed && (
                <p className="mt-4 text-center text-xs text-amber-400">
                  Petdex no respondió. Conservamos las opciones ya cargadas.
                </p>
              )}

              {!avatarLoading && avatarNextCursor !== null && avatarResults.length > 0 && (
                <button
                  type="button"
                  onClick={handleLoadMoreAvatars}
                  disabled={avatarLoadingMore}
                  className="mx-auto mt-6 block rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-emerald-500 disabled:opacity-50"
                >
                  {avatarLoadingMore ? "Cargando más..." : "Cargar más avatares"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-room-title"
            className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="create-room-title" className="text-xl font-bold">Crear sala pública</h2>
                <p className="mt-1 text-sm text-zinc-400">Configura los asientos antes de abrir la sala.</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} aria-label="Cerrar creación de sala" className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="mb-3 text-xs font-bold uppercase tracking-wider text-zinc-400">
                Asientos adicionales ({seats.length})
              </div>
              <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                {seats.length === 0 && (
                  <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-sm text-zinc-500">Sin asientos adicionales.</p>
                )}
                {seats.map((kind, index) => {
                  const option = SEAT_OPTIONS.find((item) => item.kind === kind)!;
                  return (
                    <div key={`${kind}-${index}`} className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2 text-sm">
                      <div>
                        <span className="font-semibold text-white">{option.label}</span>
                        <span className="ml-2 text-xs text-zinc-500">{option.description}</span>
                      </div>
                      <button type="button" onClick={() => removeSeat(index)} className="text-xs font-semibold text-rose-400 hover:text-rose-300">Quitar</button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {SEAT_OPTIONS.map((option) => (
                  <button type="button" key={option.kind} onClick={() => addSeat(option.kind)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:border-emerald-500">
                    Añadir {option.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-zinc-500">
              La sala será pública. La configuración BYOK permanece solo en esta sesión y nunca incluye la API key en la URL.
            </p>
            <button type="button" onClick={handleCreate} className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-[0.99]">
              Crear y entrar a la sala
            </button>
          </div>
        </div>
      )}

      {showByokModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
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

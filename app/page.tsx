"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_COLLECTIONS } from "@/lib/gameLogic";



type PetdexPet = {
  slug: string;
  displayName: string;
  spritesheetPath: string;
  dominantColor?: string;
};

const PETDEX_CURATED_COUNT = 12;
const PETDEX_PAGE_SIZE = 30;
const HOST_STORAGE_PREFIX = "pinturillo-host:";
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

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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

function PetdexSprite({ pet }: { pet: PetdexPet }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset per-image state when the spritesheet URL changes so the previous
  // image's loading/error state never leaks onto the new sprite.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [pet.spritesheetPath]);

  return (
    <span
      role="img"
      aria-label={pet.displayName}
      className="relative flex aspect-[12/13] h-full max-h-full items-center justify-center overflow-hidden rounded-sm bg-zinc-700 text-center text-xs font-bold text-white"
      style={{ backgroundColor: pet.dominantColor }}
    >
      {!loaded && !failed && <SpriteLoading />}
      {failed && pet.displayName.slice(0, 1).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden="true"
        src={pet.spritesheetPath}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute left-0 top-0 h-auto w-[800%] max-w-none [image-rendering:pixelated] ${failed ? "hidden" : ""}`}
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"mixed" | "agents-only">("mixed");
  const [humanCapacity, setHumanCapacity] = useState(6);
  const [createAgentCount, setCreateAgentCount] = useState(1);
  const [createDifficulty, setCreateDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [createRounds, setCreateRounds] = useState(3);
  const [createDrawTime, setCreateDrawTime] = useState(60);
  const [createLateJoin, setCreateLateJoin] = useState<"spectator" | "closed">("spectator");
  const [createCollections, setCreateCollections] = useState<string[]>([]);

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
  const [shuffledCuratedPets, setShuffledCuratedPets] =
    useState<PetdexPet[]>(curatedPets);

  const router = useRouter();

  useEffect(() => {
    setShuffledCuratedPets(shuffleArray(curatedPets));
  }, [curatedPets]);

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

  const buildRoomParams = () => {
    const params = new URLSearchParams();
    params.set("name", name || "Jugador");
    if (selectedAvatar) {
      params.set("avatarSlug", selectedAvatar.slug);
      params.set("avatarDisplayName", selectedAvatar.displayName);
      params.set("avatarSpritesheet", selectedAvatar.spritesheetPath);
      if (selectedAvatar.dominantColor) {
        params.set("avatarColor", selectedAvatar.dominantColor);
      }
    }
    return params;
  };

  const handleCreate = () => {
    const id = Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem(`${HOST_STORAGE_PREFIX}${id}`, "1");
    const params = buildRoomParams();
    params.set("mode", createMode);
    params.set("capacity", String(humanCapacity));
    params.set("agents", String(createAgentCount));
    if (createAgentCount > 0) {
      params.set("difficulty", createDifficulty);
    }
    params.set("rounds", String(createRounds));
    params.set("drawTime", String(createDrawTime));
    params.set("lateJoin", createLateJoin);
    params.set("collections", createCollections.join(","));
    router.push(`/room/${id}?${params.toString()}`);
  };

  const toggleCreateCollection = (id: string) => {
    setCreateCollections((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  };

  const handleJoin = () => {
    if (!roomId.trim()) return;
    const params = buildRoomParams();
    router.push(`/room/${roomId.trim()}?${params.toString()}`);
  };

  const handleJoinRandom = () => {
    const id = Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem(`${HOST_STORAGE_PREFIX}${id}`, "1");
    const params = buildRoomParams();
    params.set("mode", "mixed");
    params.set("capacity", "6");
    params.set("agents", "1");
    params.set("rounds", "3");
    params.set("drawTime", "60");
    params.set("lateJoin", "spectator");
    router.push(`/room/${id}?${params.toString()}`);
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

  const nearbyPets = shuffledCuratedPets.some(
    (pet) => pet.slug === selectedAvatar.slug
  )
    ? shuffledCuratedPets
    : [
        selectedAvatar,
        ...shuffledCuratedPets.filter((pet) => pet.slug !== selectedAvatar.slug),
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
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="create-room-title" className="text-xl font-bold">Crear sala pública</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-400">
                  Elige cómo quieres jugar. Cualquier persona puede unirse mientras haya espacio.
                </p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} aria-label="Cerrar creación de sala" className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-zinc-950 p-1.5">
              <button
                type="button"
                onClick={() => setCreateMode("mixed")}
                aria-pressed={createMode === "mixed"}
                className={`rounded-lg px-3 py-3 text-left transition ${createMode === "mixed" ? "bg-emerald-500 text-zinc-950 shadow-sm" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
              >
                <span className="block text-sm font-bold">Sala mixta</span>
                <span className={`mt-0.5 block text-xs ${createMode === "mixed" ? "text-emerald-950/80" : "text-zinc-500"}`}>
                  Juega con personas y agentes
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateMode("agents-only");
                  setCreateAgentCount((count) => Math.max(2, count));
                }}
                aria-pressed={createMode === "agents-only"}
                className={`rounded-lg px-3 py-3 text-left transition ${createMode === "agents-only" ? "bg-emerald-500 text-zinc-950 shadow-sm" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
              >
                <span className="block text-sm font-bold">Solo agentes</span>
                <span className={`mt-0.5 block text-xs ${createMode === "agents-only" ? "text-emerald-950/80" : "text-zinc-500"}`}>
                  Mira la partida como espectador
                </span>
              </button>
            </div>

            {createMode === "mixed" ? (
              <div className="mt-5 space-y-5">
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Capacidad de jugadores</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">Tu lugar está incluido.</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-emerald-400">{humanCapacity} personas</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {[2, 3, 4, 5, 6, 7, 8].map((capacity) => (
                      <button
                        type="button"
                        key={capacity}
                        onClick={() => setHumanCapacity(capacity)}
                        aria-pressed={humanCapacity === capacity}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${humanCapacity === capacity ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
                      >
                        {capacity}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Agentes en la sala</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">Se suman a la partida junto a los jugadores.</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-emerald-400">{createAgentCount}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {[0, 1, 2, 3, 4, 5, 6].map((count) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setCreateAgentCount(count)}
                        aria-label={`${count} agentes`}
                        aria-pressed={createAgentCount === count}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${createAgentCount === count ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {createAgentCount > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-white">Dificultad de los agentes</h3>
                    <div className="mt-3 space-y-2">
                      {[
                        { value: "easy", label: "Fácil", description: "Respuestas más simples y menor consumo por partida." },
                        { value: "medium", label: "Media", description: "Equilibrio entre partidas ágiles y buenas decisiones." },
                        { value: "hard", label: "Difícil", description: "Más deliberación para partidas exigentes y mayor consumo." },
                      ].map((difficulty) => (
                        <button
                          type="button"
                          key={difficulty.value}
                          onClick={() => setCreateDifficulty(difficulty.value as "easy" | "medium" | "hard")}
                          aria-pressed={createDifficulty === difficulty.value}
                          className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition ${createDifficulty === difficulty.value ? "border-emerald-400 bg-emerald-500/15" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}
                        >
                          <span>
                            <span className={`block text-sm font-bold ${createDifficulty === difficulty.value ? "text-emerald-300" : "text-white"}`}>{difficulty.label}</span>
                            <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{difficulty.description}</span>
                          </span>
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${createDifficulty === difficulty.value ? "bg-emerald-400" : "bg-zinc-700"}`} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-5">
                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">Agentes en la partida</h3>
                      <p className="mt-1 text-xs leading-5 text-zinc-500">Serás espectador mientras los agentes juegan.</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-emerald-400">{createAgentCount}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {[2, 3, 4, 5, 6].map((count) => (
                      <button
                        type="button"
                        key={count}
                        onClick={() => setCreateAgentCount(count)}
                        aria-label={`${count} agentes`}
                        aria-pressed={createAgentCount === count}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${createAgentCount === count ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white">Dificultad de los agentes</h3>
                  <div className="mt-3 space-y-2">
                    {[
                      { value: "easy", label: "Fácil", description: "Respuestas más simples y menor consumo por partida." },
                      { value: "medium", label: "Media", description: "Equilibrio entre partidas ágiles y buenas decisiones." },
                      { value: "hard", label: "Difícil", description: "Más deliberación para partidas exigentes y mayor consumo." },
                    ].map((difficulty) => (
                      <button
                        type="button"
                        key={difficulty.value}
                        onClick={() => setCreateDifficulty(difficulty.value as "easy" | "medium" | "hard")}
                        aria-pressed={createDifficulty === difficulty.value}
                        className={`flex w-full items-center justify-between gap-4 rounded-xl border p-3 text-left transition ${createDifficulty === difficulty.value ? "border-emerald-400 bg-emerald-500/15" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}
                      >
                        <span>
                          <span className={`block text-sm font-bold ${createDifficulty === difficulty.value ? "text-emerald-300" : "text-white"}`}>{difficulty.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{difficulty.description}</span>
                        </span>
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${createDifficulty === difficulty.value ? "bg-emerald-400" : "bg-zinc-700"}`} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">Rondas</h3>
                  <span className="text-sm font-bold text-emerald-400">{createRounds}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[3, 4, 5].map((rounds) => (
                    <button
                      type="button"
                      key={rounds}
                      onClick={() => setCreateRounds(rounds)}
                      aria-pressed={createRounds === rounds}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${createRounds === rounds ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
                    >
                      {rounds}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-white">Tiempo de dibujo</h3>
                  <span className="text-sm font-bold text-emerald-400">{createDrawTime}s</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[45, 60, 90].map((seconds) => (
                    <button
                      type="button"
                      key={seconds}
                      onClick={() => setCreateDrawTime(seconds)}
                      aria-pressed={createDrawTime === seconds}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${createDrawTime === seconds ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
                    >
                      {seconds}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Entrada tardía</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Qué pasa si alguien entra con la partida en curso.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreateLateJoin("spectator")}
                  aria-pressed={createLateJoin === "spectator"}
                  className={`rounded-xl border p-3 text-left transition ${createLateJoin === "spectator" ? "border-emerald-400 bg-emerald-500/15" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}
                >
                  <span className={`block text-sm font-bold ${createLateJoin === "spectator" ? "text-emerald-300" : "text-white"}`}>Espectador</span>
                  <span className="mt-0.5 block text-xs leading-5 text-zinc-500">Puede mirar sin sumarse al juego.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateLateJoin("closed")}
                  aria-pressed={createLateJoin === "closed"}
                  className={`rounded-xl border p-3 text-left transition ${createLateJoin === "closed" ? "border-emerald-400 bg-emerald-500/15" : "border-zinc-700 bg-zinc-950 hover:border-zinc-500"}`}
                >
                  <span className={`block text-sm font-bold ${createLateJoin === "closed" ? "text-emerald-300" : "text-white"}`}>Cerrada</span>
                  <span className="mt-0.5 block text-xs leading-5 text-zinc-500">No admite entradas una vez empezada.</span>
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Origen de logos</h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">El catálogo abierto usa los 206 logos de TryElements. Una colección limita las opciones.</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCreateCollections([])}
                  aria-pressed={createCollections.length === 0}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${createCollections.length === 0 ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
                >
                  Catálogo abierto
                </button>
                {LOGO_COLLECTIONS.map((collection) => (
                  <button
                    type="button"
                    key={collection.id}
                    onClick={() => toggleCreateCollection(collection.id)}
                    aria-pressed={createCollections.includes(collection.id)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${createCollections.includes(collection.id) ? "border-emerald-400 bg-emerald-500/15 text-emerald-300" : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white"}`}
                  >
                    {collection.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-5 text-xs leading-5 text-zinc-500">La sala será pública.</p>
            <button type="button" onClick={handleCreate} className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400 active:scale-[0.99]">
              Crear y entrar a la sala
            </button>
          </div>
        </div>
      )}

    </main>
  );
}

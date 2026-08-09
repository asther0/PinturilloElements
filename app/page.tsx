"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_COLLECTIONS } from "@/lib/logoCollections";
import { petdexSpriteSrc } from "@/lib/petdexImage";

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
      className="relative flex aspect-[12/13] h-full max-h-full items-center justify-center overflow-hidden rounded-sm bg-[#111111] text-center text-xs font-bold text-white"
      style={{ backgroundColor: pet.dominantColor }}
    >
      {!loaded && !failed && <SpriteLoading />}
      {failed && pet.displayName.slice(0, 1).toUpperCase()}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden="true"
        src={petdexSpriteSrc(pet.spritesheetPath)}
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
  const [humanCapacity, setHumanCapacity] = useState(6);
  const [createRounds, setCreateRounds] = useState(3);
  const [createDrawTime, setCreateDrawTime] = useState(60);
  const [createLateJoin, setCreateLateJoin] = useState<"spectator" | "closed">("spectator");
  const [createCollections, setCreateCollections] = useState<string[]>([]);
  const [collectionSearch, setCollectionSearch] = useState("");

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
    params.set("capacity", String(humanCapacity));
    params.set("rounds", String(createRounds));
    params.set("drawTime", String(createDrawTime));
    params.set("lateJoin", createLateJoin);
    params.set("collections", createCollections.join(","));
    router.push(`/room/${id}?${params.toString()}`);
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
    params.set("capacity", "6");
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
    <main className="relative flex h-screen flex-col items-center overflow-x-hidden overflow-y-auto bg-[#E7E2D4] px-4 py-10 text-[#111111]">
      <section className="relative my-auto w-full max-w-xl">
        <header className="mb-7 text-center">
          <div
            className="mb-4 inline-block border-2 border-[#111111] bg-[#F5D033] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#111111]"
            style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
          >
            MVP INTERNO
          </div>
          <h1
            className="text-[38px] font-bold leading-[1.05] tracking-[-0.01em] sm:text-[46px]"
            style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
          >
            PinturilloElements
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-[1.6] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>
            Tres rondas para dibujar empresas tech de memoria. Entra a una sala pública y empieza a jugar.
          </p>
        </header>

        <div className="rounded-[14px] border-2 border-[#111111] bg-[#FFFDF7] p-5 shadow-[5px_5px_0_#111111] sm:p-6">
          <label
            className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6B62]"
            style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
          >
            Nombre del jugador
          </label>
          <input
            type="text"
            placeholder="Tu nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full border-2 border-[#111111] bg-[#FFFDF7] px-4 py-3 text-[15px] text-[#111111] placeholder-[#6B6B62] outline-none transition focus:shadow-[3px_3px_0_#111111]"
            style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
          />

          <div className="mt-4 border-2 border-[#111111] bg-[#FFFDF7] p-4">
            <div className="flex items-center justify-between">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6B62]"
                style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
              >
                Tu avatar Petdex
              </span>
              {petsLoading && <span className="text-[11px] text-[#6B6B62]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Cargando...</span>}
              {!petsLoading && usingFallbackPets && (
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#F5D033]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Catálogo de respaldo</span>
              )}
            </div>

            <div className="mt-3 text-center">
              <div className="relative mx-auto h-20 w-20">
                <div className="petdex-avatar-float relative flex h-full w-full items-center justify-center overflow-hidden border-2 border-[#111111] bg-[#E7E2D4] p-1 shadow-[3px_3px_0_#111111]">
                  <PetdexSprite pet={selectedAvatar} />
                </div>
              </div>
              <div
                className="mt-1.5 truncate text-[12px] font-medium text-[#6B6B62]"
                style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
              >
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
                    className={`flex aspect-square items-center justify-center overflow-hidden border-2 p-1 transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                      selectedAvatar.slug === pet.slug
                        ? "border-[#7EB6FF] bg-[#7EB6FF]/10 shadow-[3px_3px_0_#111111]"
                        : "border-[#111111] bg-[#E7E2D4] hover:bg-[#FFFDF7]"
                    }`}
                    style={{ borderRadius: "6px" }}
                  >
                    <PetdexSprite pet={pet} />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarModal(true)}
                className="mx-auto mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#6B6B62] transition hover:text-[#111111]"
                style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
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
            className="mt-4 w-full border-2 border-[#111111] bg-[#7EB6FF] px-4 py-4 text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111] shadow-[5px_5px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
          >
            Unirse a sala aleatoria
          </button>

          <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6B62]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>
            <span className="h-px flex-1 bg-[#111111]/20" />
            Otras opciones
            <span className="h-px flex-1 bg-[#111111]/20" />
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Código de sala"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="min-w-0 flex-1 border-2 border-[#111111] bg-[#FFFDF7] px-4 py-3 text-[15px] text-[#111111] placeholder-[#6B6B62] outline-none transition focus:shadow-[3px_3px_0_#111111]"
              style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={!roomId.trim()}
              className="border-2 border-[#111111] bg-[#FFFDF7] px-4 py-3 text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111] shadow-[3px_3px_0_#111111] transition hover:bg-[#E7E2D4] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-40 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
            >
              Unirse
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-3 w-full border-2 border-[#111111] bg-[#FFFDF7] px-4 py-3 text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111] shadow-[3px_3px_0_#111111] transition hover:bg-[#E7E2D4] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
            style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
          >
            Crear sala pública
          </button>
          <p className="mt-3 text-center text-[12px] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>
            Todas las salas de este MVP son públicas.
          </p>
        </div>
      </section>

      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/85 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-dialog-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[14px] border-2 border-[#111111] bg-[#FFFDF7] shadow-[8px_8px_0_#111111]"
          >
            <div className="flex items-start justify-between border-b-2 border-[#111111] bg-[#6FA8F5] p-5">
              <div>
                <h2
                  id="avatar-dialog-title"
                  className="text-[18px] font-bold uppercase tracking-[0.06em] text-[#111111]"
                  style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                >
                  Elige tu avatar Petdex
                </h2>
                <p className="mt-1 text-[13px] text-[#111111]/80" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>
                  {avatarTotal.toLocaleString("es-PE")} opciones en el catálogo público
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                aria-label="Cerrar catálogo de avatares"
                className="border-2 border-[#111111] bg-[#FFFDF7] p-2 text-[#111111] shadow-[3px_3px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="border-b-2 border-[#111111] p-4">
              <label className="relative block">
                <span className="sr-only">Buscar avatares</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B62]" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  value={avatarSearch}
                  onChange={(event) => setAvatarSearch(event.target.value)}
                  placeholder="Buscar por nombre, personaje o estilo"
                  className="w-full border-2 border-[#111111] bg-[#FFFDF7] py-3 pl-10 pr-4 text-[15px] text-[#111111] placeholder-[#6B6B62] outline-none transition focus:shadow-[3px_3px_0_#111111]"
                  style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
                />
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              {avatarLoading ? (
                <div className="py-16 text-center text-[15px] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>Cargando catálogo Petdex...</div>
              ) : avatarResults.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-[16px] font-bold text-[#111111]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>No encontramos avatares</div>
                  <div className="mt-1 text-[13px] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>Prueba con otra búsqueda.</div>
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
                      className={`group min-w-0 border-2 p-2 text-left transition hover:-translate-y-0.5 ${
                        selectedAvatar.slug === pet.slug
                          ? "border-[#7EB6FF] bg-[#7EB6FF]/10 shadow-[3px_3px_0_#111111]"
                          : "border-[#111111] bg-[#E7E2D4] hover:bg-[#FFFDF7]"
                      }`}
                      style={{ borderRadius: "6px" }}
                    >
                      <span className="mx-auto flex h-16 items-center justify-center overflow-hidden p-1" style={{ borderRadius: "4px" }}>
                        <PetdexSprite pet={pet} />
                      </span>
                      <span
                        className="mt-2 block truncate text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[#111111] group-hover:text-[#111111]"
                        style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                      >
                        {pet.displayName}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {avatarLoadFailed && (
                <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.06em] text-[#F5D033]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>
                  Petdex no respondió. Conservamos las opciones ya cargadas.
                </p>
              )}

              {!avatarLoading && avatarNextCursor !== null && avatarResults.length > 0 && (
                <button
                  type="button"
                  onClick={handleLoadMoreAvatars}
                  disabled={avatarLoadingMore}
                  className="mx-auto mt-6 block border-2 border-[#111111] bg-[#FFFDF7] px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.06em] text-[#111111] shadow-[3px_3px_0_#111111] transition hover:bg-[#E7E2D4] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:opacity-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                  style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                >
                  {avatarLoadingMore ? "Cargando más..." : "Cargar más avatares"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111111]/85 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-room-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[14px] border-2 border-[#111111] bg-[#FFFDF7] p-5 shadow-[8px_8px_0_#111111] sm:p-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2
                  id="create-room-title"
                  className="text-[18px] font-bold uppercase tracking-[0.06em] text-[#111111]"
                  style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                >
                  Crear sala pública
                </h2>
                <p className="mt-1 text-[13px] leading-[1.6] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>
                  Configura la partida. Cualquier persona puede unirse mientras haya espacio.
                </p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} aria-label="Cerrar creación de sala" className="border-2 border-[#111111] bg-[#FFFDF7] p-2 text-[#111111] shadow-[3px_3px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h3 className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#111111]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Capacidad de jugadores</h3>
                    <p className="mt-1 text-[12px] leading-[1.5] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>Tu lugar está incluido.</p>
                  </div>
                  <span className="shrink-0 text-[13px] font-bold uppercase tracking-[0.04em] text-[#7EB6FF]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>{humanCapacity} personas</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {[2, 3, 4, 5, 6, 7, 8].map((capacity) => (
                    <button
                      type="button"
                      key={capacity}
                      onClick={() => setHumanCapacity(capacity)}
                      aria-pressed={humanCapacity === capacity}
                      className={`border-2 px-3 py-2.5 text-[13px] font-bold uppercase tracking-[0.04em] transition ${humanCapacity === capacity ? "border-[#111111] bg-[#7EB6FF] text-[#111111] shadow-[3px_3px_0_#111111]" : "border-[#111111] bg-[#E7E2D4] text-[#6B6B62] hover:bg-[#FFFDF7] hover:text-[#111111]"}`}
                      style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                    >
                      {capacity}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#111111]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Rondas</h3>
                  <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#7EB6FF]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>{createRounds}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[3, 4, 5].map((rounds) => (
                    <button
                      type="button"
                      key={rounds}
                      onClick={() => setCreateRounds(rounds)}
                      aria-pressed={createRounds === rounds}
                      className={`border-2 px-3 py-2.5 text-[13px] font-bold uppercase tracking-[0.04em] transition ${createRounds === rounds ? "border-[#111111] bg-[#7EB6FF] text-[#111111] shadow-[3px_3px_0_#111111]" : "border-[#111111] bg-[#E7E2D4] text-[#6B6B62] hover:bg-[#FFFDF7] hover:text-[#111111]"}`}
                      style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                    >
                      {rounds}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#111111]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Tiempo de dibujo</h3>
                  <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#7EB6FF]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>{createDrawTime}s</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[45, 60, 90].map((seconds) => (
                    <button
                      type="button"
                      key={seconds}
                      onClick={() => setCreateDrawTime(seconds)}
                      aria-pressed={createDrawTime === seconds}
                      className={`border-2 px-3 py-2.5 text-[13px] font-bold uppercase tracking-[0.04em] transition ${createDrawTime === seconds ? "border-[#111111] bg-[#7EB6FF] text-[#111111] shadow-[3px_3px_0_#111111]" : "border-[#111111] bg-[#E7E2D4] text-[#6B6B62] hover:bg-[#FFFDF7] hover:text-[#111111]"}`}
                      style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
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
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#111111]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Entrada tardia</h3>
                  <p className="mt-1 text-[12px] leading-[1.5] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>Que pasa si alguien entra con la partida en curso.</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCreateLateJoin("spectator")}
                  aria-pressed={createLateJoin === "spectator"}
                  className={`border-2 p-3 text-left transition ${createLateJoin === "spectator" ? "border-[#111111] bg-[#7EB6FF]/20 shadow-[3px_3px_0_#111111]" : "border-[#111111] bg-[#E7E2D4] hover:bg-[#FFFDF7]"}`}
                >
                  <span className={`block text-[13px] font-bold uppercase tracking-[0.04em] ${createLateJoin === "spectator" ? "text-[#111111]" : "text-[#111111]"}`} style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Espectador</span>
                  <span className="mt-0.5 block text-[12px] leading-[1.5] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>Puede mirar sin sumarse al juego.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateLateJoin("closed")}
                  aria-pressed={createLateJoin === "closed"}
                  className={`border-2 p-3 text-left transition ${createLateJoin === "closed" ? "border-[#111111] bg-[#7EB6FF]/20 shadow-[3px_3px_0_#111111]" : "border-[#111111] bg-[#E7E2D4] hover:bg-[#FFFDF7]"}`}
                >
                  <span className={`block text-[13px] font-bold uppercase tracking-[0.04em] ${createLateJoin === "closed" ? "text-[#111111]" : "text-[#111111]"}`} style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Cerrada</span>
                  <span className="mt-0.5 block text-[12px] leading-[1.5] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>No admite entradas una vez empezada.</span>
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.04em] text-[#111111]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>Origen de logos</h3>
                  <p className="mt-1 text-[12px] leading-[1.5] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>
                    El catalogo abierto usa los 206 logos de TryElements. Una coleccion limita las opciones.
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.06em] text-[#7EB6FF]" style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}>
                  {createCollections.length > 0
                    ? `${LOGO_COLLECTIONS.filter((c) => createCollections.includes(c.id)).reduce((sum, c) => sum + c.words.length, 0)} logos`
                    : "206 logos"}
                </span>
              </div>
              <div className="mt-3">
                <label className="relative block">
                  <span className="sr-only">Buscar colecciones</span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B62]" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="search"
                    value={collectionSearch}
                    onChange={(event) => setCollectionSearch(event.target.value)}
                    placeholder="Filtrar colecciones..."
                    className="w-full border-2 border-[#111111] bg-[#FFFDF7] py-2.5 pl-9 pr-3 text-[13px] text-[#111111] placeholder-[#6B6B62] outline-none transition focus:shadow-[3px_3px_0_#111111]"
                    style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
                  />
                </label>
              </div>
              <div className="mt-2 max-h-[200px] overflow-y-auto border-2 border-[#111111] bg-[#E7E2D4] p-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateCollections([]);
                    setCollectionSearch("");
                  }}
                  aria-pressed={createCollections.length === 0}
                  className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px] font-bold uppercase tracking-[0.04em] transition ${createCollections.length === 0 ? "border-2 border-[#111111] bg-[#7EB6FF]/20 shadow-[3px_3px_0_#111111] text-[#111111]" : "text-[#6B6B62] hover:border-2 hover:border-[#111111] hover:bg-[#FFFDF7] hover:text-[#111111]"}`}
                  style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                >
                  <span>Catalogo abierto</span>
                  <span className="text-[11px] font-medium text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>206</span>
                </button>
                {LOGO_COLLECTIONS.filter((c) =>
                  collectionSearch.trim()
                    ? c.label.toLowerCase().includes(collectionSearch.trim().toLowerCase())
                    : true
                ).map((collection) => (
                  <button
                    type="button"
                    key={collection.id}
                    onClick={() => {
                      setCreateCollections((current) =>
                        current.includes(collection.id)
                          ? current.filter((id) => id !== collection.id)
                          : [...current, collection.id]
                      );
                    }}
                    aria-pressed={createCollections.includes(collection.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[13px] transition ${createCollections.includes(collection.id) ? "border-2 border-[#111111] bg-[#7EB6FF]/20 shadow-[3px_3px_0_#111111] text-[#111111]" : "text-[#6B6B62] hover:border-2 hover:border-[#111111] hover:bg-[#FFFDF7] hover:text-[#111111]"}`}
                    style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
                  >
                    <span className="font-semibold">{collection.label}</span>
                    <span className="text-[11px] font-medium text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>{collection.words.length}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-5 text-[12px] leading-[1.5] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>La sala sera publica.</p>
            <button
              type="button"
              onClick={handleCreate}
              className="mt-4 w-full border-2 border-[#111111] bg-[#7EB6FF] px-4 py-3 text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111] shadow-[5px_5px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_#111111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
              style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
            >
              Crear y entrar a la sala
            </button>
          </div>
        </div>
      )}

    </main>
  );
}

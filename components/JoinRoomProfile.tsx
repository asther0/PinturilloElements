"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { petdexSpriteSrc } from "@/lib/petdexImage";

type PetdexPet = {
  slug: string;
  displayName: string;
  spritesheetPath: string;
  dominantColor?: string;
};

const FALLBACK_PETS: PetdexPet[] = [
  { slug: "nezukocoder", displayName: "NezukoCoder", spritesheetPath: "https://assets.petdex.dev/pets/nezukocoder-7d766f7c2597/sprite.webp", dominantColor: "#c65922" },
  { slug: "shinchan", displayName: "Shinchan", spritesheetPath: "https://assets.petdex.dev/pets/shinchan-154a84d8ff3c/sprite.webp", dominantColor: "#de1f1a" },
  { slug: "capvolt", displayName: "Pikachu", spritesheetPath: "https://assets.petdex.dev/pets/capvolt-7be64ef6cfa2/sprite.webp", dominantColor: "#f7d605" },
  { slug: "doraemon", displayName: "Doraemon", spritesheetPath: "https://assets.petdex.dev/pets/doraemon-58b12a5012e0/sprite.webp", dominantColor: "#048ae1" },
];

function parsePet(value: unknown): PetdexPet | null {
  if (!value || typeof value !== "object") return null;
  const pet = value as Record<string, unknown>;
  if (typeof pet.slug !== "string" || typeof pet.spritesheetPath !== "string") return null;

  try {
    const url = new URL(pet.spritesheetPath);
    if (url.protocol !== "https:" || url.hostname !== "assets.petdex.dev" || !url.pathname.startsWith("/pets/")) return null;
  } catch {
    return null;
  }

  const displayName = (typeof pet.displayName === "string" ? pet.displayName : pet.slug)
    .replace(/[\p{Extended_Pictographic}\p{Cf}]/gu, "")
    .trim()
    .slice(0, 100);

  return {
    slug: pet.slug.slice(0, 100),
    displayName: displayName || pet.slug.slice(0, 100),
    spritesheetPath: pet.spritesheetPath,
    dominantColor: typeof pet.dominantColor === "string" && /^#[0-9a-f]{6}$/i.test(pet.dominantColor) ? pet.dominantColor : undefined,
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

function PetSprite({ pet }: { pet: PetdexPet }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Reset per-image state when the spritesheet URL changes so the previous
  // sprite's loading/error state never leaks onto a newly selected pet.
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [pet.spritesheetPath]);

  return (
    <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {!loaded && !failed && <SpriteLoading />}
      {failed && (
        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
          {pet.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={petdexSpriteSrc(pet.spritesheetPath)}
        alt=""
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute left-0 top-0 h-auto w-[800%] max-w-none [image-rendering:pixelated] ${failed ? "hidden" : ""}`}
      />
    </span>
  );
}

export default function JoinRoomProfile({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pets, setPets] = useState<PetdexPet[]>(FALLBACK_PETS);
  const [selectedPet, setSelectedPet] = useState<PetdexPet>(FALLBACK_PETS[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/petdex-api/pets/search?limit=8&sort=popular", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Petdex unavailable");
        const payload = await response.json() as { pets?: unknown[] };
        const nextPets = (Array.isArray(payload.pets) ? payload.pets : [])
          .map(parsePet)
          .filter((pet): pet is PetdexPet => pet !== null)
          .slice(0, 8);
        if (nextPets.length === 0) throw new Error("No usable pets");
        setPets(nextPets);
        setSelectedPet(nextPets[0]);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const continueToRoom = () => {
    const trimmedName = name.trim().slice(0, 32);
    if (!trimmedName || !selectedPet) return;
    const params = new URLSearchParams({
      name: trimmedName,
      avatarSlug: selectedPet.slug,
      avatarDisplayName: selectedPet.displayName,
      avatarSpritesheet: selectedPet.spritesheetPath,
    });
    if (selectedPet.dominantColor) params.set("avatarColor", selectedPet.dominantColor);
    router.replace(`/room/${encodeURIComponent(roomId)}?${params.toString()}`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-900 px-4 py-10 text-white">
      <section className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl sm:p-8">
        <p className="text-sm font-bold uppercase tracking-wider text-emerald-400">Unirse a la sala</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Elige tu perfil</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">Tu nombre y avatar aparecerán en la sala de espera.</p>

        <label className="mt-6 block text-sm font-semibold" htmlFor="join-room-name">Nombre</label>
        <input
          id="join-room-name"
          value={name}
          maxLength={32}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") continueToRoom();
          }}
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/30"
          placeholder="Tu nombre"
          autoComplete="name"
          autoFocus
        />

        <p className="mt-6 text-sm font-semibold">Avatar Petdex</p>
        <div className="mt-3 grid grid-cols-4 gap-3" aria-busy={loading}>
          {pets.map((pet) => (
            <button
              key={pet.slug}
              type="button"
              onClick={() => setSelectedPet(pet)}
              aria-label={`Elegir ${pet.displayName}`}
              aria-pressed={selectedPet.slug === pet.slug}
              className={`relative aspect-square overflow-hidden rounded-xl border bg-zinc-800 p-1 transition ${selectedPet.slug === pet.slug ? "border-emerald-400 ring-2 ring-emerald-400/40" : "border-zinc-700 hover:border-zinc-500"}`}
            >
              <PetSprite pet={pet} />
              <span className="sr-only">{pet.displayName}</span>
            </button>
          ))}
        </div>
        {loading && <p className="mt-3 text-xs text-zinc-500">Cargando avatares.</p>}

        <button
          type="button"
          onClick={continueToRoom}
          disabled={!name.trim()}
          className="mt-8 w-full rounded-xl bg-emerald-500 px-4 py-3 font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          Continuar a la sala
        </button>
      </section>
    </main>
  );
}

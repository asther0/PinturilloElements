"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PETDEX_CATALOG,
  PETDEX_INITIAL_VISIBLE_COUNT,
  type PetdexCatalogPet,
} from "@/lib/petdexCatalog";
import { petdexSpriteSrc } from "@/lib/petdexImage";

type PetdexPet = PetdexCatalogPet;

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let index = result.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
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
  const [pets, setPets] = useState<PetdexPet[]>(() =>
    PETDEX_CATALOG.slice(0, PETDEX_INITIAL_VISIBLE_COUNT)
  );
  const [selectedPet, setSelectedPet] = useState<PetdexPet>(PETDEX_CATALOG[0]);

  useEffect(() => {
    setPets(
      shuffleArray([...PETDEX_CATALOG]).slice(0, PETDEX_INITIAL_VISIBLE_COUNT)
    );
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
    <main className="flex min-h-screen items-center justify-center bg-[#E7E2D4] px-4 py-10 text-[#111111]">
      <section className="w-full max-w-lg rounded-[14px] border-2 border-[#111111] bg-[#FFFDF7] p-6 shadow-[8px_8px_0_#111111] sm:p-8">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7EB6FF]"
          style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
        >
          Unirse a la sala
        </p>
        <h1
          className="mt-2 text-[18px] font-bold uppercase tracking-[0.06em] text-[#111111]"
          style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
        >
          Elige tu perfil
        </h1>
        <p className="mt-2 text-[15px] leading-[1.6] text-[#6B6B62]" style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}>
          Tu nombre y avatar apareceran en la sala de espera.
        </p>

        <label
          className="mt-6 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6B62]"
          htmlFor="join-room-name"
          style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
        >
          Nombre
        </label>
        <input
          id="join-room-name"
          value={name}
          maxLength={32}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") continueToRoom();
          }}
          className="mt-2 w-full border-2 border-[#111111] bg-[#FFFDF7] px-4 py-3 text-[15px] text-[#111111] outline-none transition focus:shadow-[3px_3px_0_#111111]"
          style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
          placeholder="Tu nombre"
          autoComplete="name"
          autoFocus
        />

        <p
          className="mt-6 text-[11px] font-bold uppercase tracking-[0.08em] text-[#6B6B62]"
          style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
        >
          Avatar Petdex
        </p>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {pets.map((pet) => (
            <button
              key={pet.slug}
              type="button"
              onClick={() => setSelectedPet(pet)}
              aria-label={`Elegir ${pet.displayName}`}
              aria-pressed={selectedPet.slug === pet.slug}
              className={`relative aspect-square overflow-hidden border-2 bg-[#E7E2D4] p-1 transition active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${selectedPet.slug === pet.slug ? "border-[#7EB6FF] shadow-[3px_3px_0_#111111]" : "border-[#111111] hover:bg-[#FFFDF7]"}`}
              style={{ borderRadius: "6px" }}
            >
              <PetSprite pet={pet} />
              <span className="sr-only">{pet.displayName}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={continueToRoom}
          disabled={!name.trim()}
          className="mt-8 w-full border-2 border-[#111111] bg-[#7EB6FF] px-4 py-3 text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111] shadow-[5px_5px_0_#111111] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_#111111] disabled:cursor-not-allowed disabled:bg-[#E7E2D4] disabled:text-[#6B6B62] disabled:shadow-none active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
        >
          Continuar a la sala
        </button>
      </section>
    </main>
  );
}

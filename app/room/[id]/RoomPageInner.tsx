"use client";

import { useSearchParams } from "next/navigation";
import RoomPageClient from "@/components/RoomPageClient";
import type { PetdexAvatar } from "@/lib/types";

function readAvatar(searchParams: URLSearchParams): PetdexAvatar | undefined {
  const slug = searchParams.get("avatarSlug")?.slice(0, 100);
  const displayName = searchParams.get("avatarDisplayName")?.slice(0, 100);
  const spritesheetUrl = searchParams.get("avatarSpritesheet");
  const dominantColor = searchParams.get("avatarColor") || undefined;

  if (!slug || !spritesheetUrl) return undefined;

  try {
    const parsedUrl = new URL(spritesheetUrl);
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "assets.petdex.dev" ||
      !parsedUrl.pathname.startsWith("/pets/")
    ) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return {
    slug,
    displayName: displayName || slug,
    spritesheetUrl,
    dominantColor:
      dominantColor && /^#[0-9a-f]{6}$/i.test(dominantColor)
        ? dominantColor
        : undefined,
  };
}

export default function RoomPageInner({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "Jugador";

  const seatsParam = searchParams.get("seats") || "";
  const seatKinds = seatsParam
    .split(",")
    .filter(Boolean)
    .map((s) => s.trim()) as Array<"human" | "agent-byok" | "room-agent">;

  const byokProvider = searchParams.get("byokProvider") || "openai";
  const byokModel = searchParams.get("byokModel") || "gpt-4o-mini";

  const avatar = readAvatar(searchParams);

  const seats = seatKinds.map((kind) => ({
    kind,
    name: kind === "room-agent" ? "Bot" : kind === "agent-byok" ? "Agente" : undefined,
    config: kind === "agent-byok" ? { provider: byokProvider as "openai", model: byokModel } : undefined,
  }));

  return <RoomPageClient roomId={roomId} playerName={name} seats={seats} avatar={avatar} />;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoomPageClient from "@/components/RoomPageClient";
import JoinRoomProfile from "@/components/JoinRoomProfile";
import type { PetdexAvatar, RoomConfig, GameMode, Difficulty } from "@/lib/types";

const HOST_STORAGE_PREFIX = "pinturillo-host:";

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

function readRoomConfig(searchParams: URLSearchParams): RoomConfig {
  const modeParam = searchParams.get("mode") || "mixed";
  const mode: GameMode = modeParam === "agents-only" ? "agents-only" : "mixed";

  const capacityParam = parseInt(searchParams.get("capacity") || "6", 10);
  const capacity = [2, 4, 6, 8].includes(capacityParam) ? capacityParam : 6;

  const agentsParam = parseInt(searchParams.get("agents") || "0", 10);
  const agentCount = Math.max(0, Math.min(6, agentsParam));

  const diffParam = searchParams.get("difficulty") || "medium";
  const difficulty: Difficulty =
    diffParam === "easy" || diffParam === "hard" ? diffParam : "medium";

  return {
    mode,
    humanCapacity: capacity,
    agentCount,
    difficulty: mode === "agents-only" ? difficulty : undefined,
  };
}

function generatePlayerId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function RoomPageInner({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const name = searchParams.get("name")?.trim().slice(0, 32) || "";

  const [isHost, setIsHost] = useState(false);
  const [hostResolved, setHostResolved] = useState(false);

  useEffect(() => {
    let host = false;
    try {
      host = sessionStorage.getItem(`${HOST_STORAGE_PREFIX}${roomId}`) === "1";
    } catch {
      host = false;
    }
    setIsHost(host);
    setHostResolved(true);
  }, [roomId]);

  const roomConfig = readRoomConfig(searchParams);
  const avatar = readAvatar(searchParams);
  const localPlayerId = useMemo(() => generatePlayerId(), []);

  if (!name || !avatar) return <JoinRoomProfile roomId={roomId} />;

  if (!hostResolved) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900 text-sm text-zinc-400">
        Entrando a la sala...
      </div>
    );
  }

  return (
    <RoomPageClient
      roomId={roomId}
      playerName={name}
      localPlayerId={localPlayerId}
      isHost={isHost}
      roomConfig={roomConfig}
      avatar={avatar}
    />
  );
}

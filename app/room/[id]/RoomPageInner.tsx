"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoomPageClient from "@/components/RoomPageClient";
import JoinRoomProfile from "@/components/JoinRoomProfile";
import { LOGO_COLLECTIONS } from "@/lib/gameLogic";
import type { PetdexAvatar, RoomConfig, GameMode, Difficulty, LateJoinPolicy } from "@/lib/types";

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
  const capacity = capacityParam >= 2 && capacityParam <= 8 ? capacityParam : 6;

  const agentsParam = parseInt(searchParams.get("agents") || "0", 10);
  const agentCount = Math.max(0, Math.min(6, agentsParam));

  const diffParam = searchParams.get("difficulty") || "medium";
  const difficulty: Difficulty =
    diffParam === "easy" || diffParam === "hard" ? diffParam : "medium";

  const roundsParam = parseInt(searchParams.get("rounds") || "3", 10);
  const totalRounds = roundsParam >= 3 && roundsParam <= 5 ? roundsParam : 3;

  const drawTimeParam = parseInt(searchParams.get("drawTime") || "60", 10);
  const drawTimeSeconds =
    drawTimeParam === 45 || drawTimeParam === 90 ? drawTimeParam : 60;

  const lateJoinParam = searchParams.get("lateJoin") || "spectator";
  const lateJoinPolicy: LateJoinPolicy =
    lateJoinParam === "closed" ? "closed" : "spectator";

  const knownCollectionIds = new Set(LOGO_COLLECTIONS.map((c) => c.id));
  const logoCollections = (searchParams.get("collections") || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => knownCollectionIds.has(id));

  return {
    mode,
    humanCapacity: capacity,
    agentCount,
    difficulty: agentCount > 0 ? difficulty : undefined,
    totalRounds,
    drawTimeSeconds,
    lateJoinPolicy,
    logoCollections,
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import RoomPageClient from "@/components/RoomPageClient";
import JoinRoomProfile from "@/components/JoinRoomProfile";
import { LOGO_COLLECTIONS } from "@/lib/gameLogic";
import type { PetdexAvatar, RoomConfig, LateJoinPolicy } from "@/lib/types";

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
  const countParam = parseInt(searchParams.get("count") || "6", 10);
  const humanCount = countParam >= 2 && countParam <= 8 ? countParam : 6;

  const roundsParam = parseInt(searchParams.get("rounds") || "3", 10);
  const roundCount = roundsParam >= 3 && roundsParam <= 5 ? roundsParam : 3;

  const drawTimeParam = parseInt(searchParams.get("drawTime") || "60", 10);
  const drawTimeSeconds =
    drawTimeParam === 45 || drawTimeParam === 90 ? drawTimeParam : 60;

  const lateJoinParam = searchParams.get("lateJoin") || "spectator";
  const lateJoin: LateJoinPolicy =
    lateJoinParam === "closed" ? "closed" : "spectator";

  const knownCollectionIds = new Set(LOGO_COLLECTIONS.map((c) => c.id));
  const logoCollections = (searchParams.get("collections") || "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => knownCollectionIds.has(id));

  return {
    humanCount,
    roundCount,
    drawTimeSeconds,
    lateJoin,
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
      <main className="flex h-screen items-center justify-center bg-[#E7E2D4] px-4 text-[#111111]">
        <div className="w-full max-w-[380px] border-2 border-[#111111] bg-[#FFFDF7] p-[26px] text-center shadow-[6px_6px_0_#111111]">
          <p
            className="text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111]"
            style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
          >
            Entrando a la sala
          </p>
          <p
            className="mt-2 text-[14px] leading-[1.5] text-[#6B6B62]"
            style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
          >
            Sincronizando el estado inicial.
          </p>
        </div>
      </main>
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

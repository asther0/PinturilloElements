"use client";

import { useSearchParams } from "next/navigation";
import RoomPageClient from "@/components/RoomPageClient";

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

  const seats = seatKinds.map((kind) => ({
    kind,
    name: kind === "room-agent" ? "Bot" : kind === "agent-byok" ? "Agente" : undefined,
    config: kind === "agent-byok" ? { provider: byokProvider as "openai", model: byokModel } : undefined,
  }));

  return <RoomPageClient roomId={roomId} playerName={name} seats={seats} />;
}

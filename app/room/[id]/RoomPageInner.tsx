"use client";

import { useSearchParams } from "next/navigation";
import RoomPageClient from "@/components/RoomPageClient";

export default function RoomPageInner({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const name = searchParams.get("name") || "Jugador";
  return <RoomPageClient roomId={roomId} playerName={name} />;
}

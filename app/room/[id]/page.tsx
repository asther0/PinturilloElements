import { Suspense } from "react";
import { canonicalRoomId } from "@/lib/roomId";
import RoomPageInner from "./RoomPageInner";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const roomId = canonicalRoomId(id);
  return (
    <Suspense
      fallback={
        <main className="flex h-screen items-center justify-center bg-[#E7E2D4] px-4 text-[#111111]">
          <div className="w-full max-w-[380px] border-2 border-[#111111] bg-[#FFFDF7] p-[26px] text-center shadow-[6px_6px_0_#111111]">
            <p
              className="text-[14px] font-bold uppercase tracking-[0.06em] text-[#111111]"
              style={{ fontFamily: "var(--font-space-mono), Space Mono, ui-monospace, monospace" }}
            >
              Cargando sala
            </p>
            <p
              className="mt-2 text-[14px] leading-[1.5] text-[#6B6B62]"
              style={{ fontFamily: "var(--font-dm-sans), DM Sans, system-ui, sans-serif" }}
            >
              Conectando con la partida.
            </p>
          </div>
        </main>
      }
    >
      <RoomPageInner roomId={roomId} />
    </Suspense>
  );
}

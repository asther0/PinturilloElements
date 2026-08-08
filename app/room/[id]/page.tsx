import { Suspense } from "react";
import RoomPageInner from "./RoomPageInner";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-zinc-900 text-white">Cargando sala…</div>}>
      <RoomPageInner roomId={id} />
    </Suspense>
  );
}

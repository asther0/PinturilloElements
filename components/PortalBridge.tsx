"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
  ReactNode,
  MutableRefObject,
} from "react";
import { PortalEvent, PortalPresenceMetadata } from "@/lib/types";
import { roomChannelId } from "@/lib/roomId";
import { createPortalDispatch, PortalDispatch } from "@/lib/portalDispatch";
import { createPortalOutbox } from "@/lib/portalOutbox";
import {
  isPortalEventWithinBudget,
  isPortalEventWithinBudgetAfterDispatch,
  portalEventByteLength,
  PORTAL_MESSAGE_BYTE_BUDGET,
} from "@/lib/strokeGeometry";
import { PortalProvider, useChannel } from "@portalsdk/react";
import type { ChannelStatus, DetailedPresence, PortalError } from "@portalsdk/core";
import { Portal, Message } from "@portalsdk/core";

const API_KEY = process.env.NEXT_PUBLIC_PORTAL_API_KEY;
const HAS_KEY = Boolean(API_KEY && API_KEY !== "your_portal_api_key_here");
// Create Portal client synchronously if key exists (no network at construction)
const portalClient = HAS_KEY ? new Portal({ apiKey: API_KEY! }) : null;

interface PortalContextValue {
  send: (event: PortalEvent, recipientId?: string) => Promise<void>;
  connected: boolean;
  detailedPresence?: DetailedPresence;
  connectionStatus?: ChannelStatus;
  connectionError?: { code: string; message: string };
}

const PortalContext = createContext<PortalContextValue>({
  send: () => Promise.resolve(),
  connected: false,
});

export function usePortal() {
  return useContext(PortalContext);
}

// ---------------------------------------------------------------------------
// Event handler registration
//
// PortalBridge no longer takes an `onEvent` prop. Instead, a child component
// (the one that owns the game state and therefore the reducer for incoming
// events) registers its handler via `useRegisterPortalEventHandler`. This is
// what lets the inner component live *under* the provider and call
// `usePortal()` legitimately.
// ---------------------------------------------------------------------------

type EventHandler = (event: PortalEvent) => void;

function safePresenceMetadata(metadata?: PortalPresenceMetadata): PortalPresenceMetadata | undefined {
  if (!metadata || typeof metadata.playerId !== "string") return undefined;
  const playerId = metadata.playerId.trim().slice(0, 100);
  if (!playerId || (metadata.playerKind !== "human" && metadata.playerKind !== "spectator")) return undefined;
  return { playerId, playerKind: metadata.playerKind };
}

interface PresenceParticipant {
  id?: string;
  username?: string;
  anon?: boolean;
  metadata?: Record<string, unknown>;
}

function presenceSignature(presence: DetailedPresence | undefined): string {
  if (!presence) return "";
  const participants = (presence as unknown as { participants?: PresenceParticipant[] }).participants || [];
  const sorted = [...participants].sort((a, b) => String(a.id ?? "").localeCompare(String(b.id ?? "")));
  return JSON.stringify(sorted.map((p) => [p.id, p.username, p.anon, p.metadata]));
}

interface EventHandlerContextValue {
  handlerRef: MutableRefObject<EventHandler | null>;
  register: (handler: EventHandler) => void;
  unregister: (handler: EventHandler) => void;
  deliver: (event: PortalEvent, fallbackId?: string) => void;
}

const EventHandlerContext = createContext<EventHandlerContextValue | null>(null);

export function useRegisterPortalEventHandler(handler: EventHandler) {
  const ctx = useContext(EventHandlerContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.register(handler);
    return () => {
      ctx.unregister(handler);
    };
  }, [handler, ctx]);
}

// Local fallback: in-memory event bus when no Portal key is configured
function LocalFallbackProvider({
  children,
  send,
}: {
  children: ReactNode;
  send: (event: PortalEvent, recipientId?: string) => Promise<void>;
}) {

  return (
    <PortalContext.Provider value={{ send, connected: true }}>
      {children}
    </PortalContext.Provider>
  );
}

// Child component that calls useChannel at its top level (hook rules)
function ChannelListener({
  roomId,
  metadata,
  deliver,
  onSendReady,
  onConnectionChange,
  onConnectionStatusChange,
  onConnectionError,
  onPresenceChange,
}: {
  roomId: string;
  metadata?: PortalPresenceMetadata;
  deliver: (event: PortalEvent, fallbackId?: string) => void;
  onSendReady: (send: (event: PortalEvent, recipientId?: string) => Promise<void>) => void;
  onConnectionChange: (connected: boolean) => void;
  onConnectionStatusChange: (status: ChannelStatus) => void;
  onConnectionError: (error: PortalError) => void;
  onPresenceChange: (presence: DetailedPresence | undefined) => void;
}) {
  const processedMessageIds = useRef(new Set<string>());
  const lastPresenceSigRef = useRef<string>("");
  const safeMetadata = useMemo(() => safePresenceMetadata(metadata), [metadata]);
  // Latest `deliver` lives in a ref so `handleMessage` stays referentially
  // stable for `useChannel` (and never causes the channel to re-subscribe or
  // trigger a setState loop on the parent) while still dispatching every
  // incoming message to the most recent handler instance. Reading a stale
  // closure here would let portal events land on a discarded handler and be
  // silently dropped.
  const deliverRef = useRef(deliver);
  deliverRef.current = deliver;

  const handleMessage = useCallback(
    (msg: Message<string>) => {
      if (processedMessageIds.current.has(msg.id)) return;
      processedMessageIds.current.add(msg.id);
      try {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        const event: PortalEvent = { ...JSON.parse(content), senderId: msg.sender.id };
        deliverRef.current(event, msg.id);
      } catch {
        // ignore non-JSON or malformed messages
      }
    },
    []
  );

  // CRITICAL: useChannel called unconditionally at top level
  const { send, presence, status } = useChannel<string>({
    channelId: roomChannelId(roomId),
    metadata: { game: "pinturilloelements", version: "0.1.0", ...safeMetadata },
    history: "none",
    onMessage: handleMessage,
    onError: onConnectionError,
  });
  const portalSendRef = useRef(send);
  portalSendRef.current = send;
  const outboxRef = useRef(
    createPortalOutbox((input: { content: string; to?: string }) => portalSendRef.current(input))
  );

  // Expose send function to parent. useLayoutEffect guarantees this runs
  // after the component commits, avoiding setState-during-render warnings.
  useLayoutEffect(() => {
    onSendReady((event: PortalEvent, recipientId?: string) => {
      // NOTE: sender authorization is unresolved in a client-only topology;
      // any connected client can forge senderId. Host-side validation required.
      const content = JSON.stringify(event);
      const byteLength = portalEventByteLength(event);
      if (!isPortalEventWithinBudget(event)) {
        console.warn(
          `[PortalBridge] Dropping oversized ${event.type} message: ${byteLength} bytes > ${PORTAL_MESSAGE_BYTE_BUDGET}`
        );
        return Promise.resolve();
      }
      return outboxRef.current.send({ content, to: recipientId });
    });
  }, [onSendReady]);

  useEffect(() => {
    onConnectionChange(status === "ready");
    onConnectionStatusChange(status);
  }, [onConnectionChange, onConnectionStatusChange, status]);

  useEffect(() => {
    const current = presence?.kind === "detailed" ? presence : undefined;
    const sig = presenceSignature(current);
    if (sig !== lastPresenceSigRef.current) {
      lastPresenceSigRef.current = sig;
      onPresenceChange(current);
    }
  }, [onPresenceChange, presence]);

  return null;
}

export function PortalBridge({
  children,
  roomId,
  presenceMetadata,
}: {
  children: ReactNode;
  roomId: string;
  presenceMetadata?: PortalPresenceMetadata;
}) {
  const portalSendRef = useRef<((event: PortalEvent, recipientId?: string) => Promise<void>) | null>(null);
  const [connected, setConnected] = useState(false);
  const [detailedPresence, setDetailedPresence] = useState<DetailedPresence>();
  const [connectionStatus, setConnectionStatus] = useState<ChannelStatus>();
  const [connectionError, setConnectionError] = useState<{ code: string; message: string }>();
  const handlerRef = useRef<EventHandler | null>(null);
  const pendingEventsRef = useRef<PortalEvent[]>([]);
  const pendingOutboundRef = useRef<
    { event: PortalEvent; recipientId?: string; resolve: () => void }[]
  >([]);
  const latestPublishRef = useRef<Promise<void>>(Promise.resolve());
  const dispatchRef = useRef<PortalDispatch | null>(null);

  const deliverLocal = useCallback((event: PortalEvent) => {
    const handler = handlerRef.current;
    if (handler) {
      handler(event);
    } else {
      pendingEventsRef.current.push(event);
    }
  }, []);

  if (!dispatchRef.current) {
    dispatchRef.current = createPortalDispatch({
      deliverLocal,
      publishRemote: (event, recipientId) => {
        if (!HAS_KEY || !portalClient) return;
        if (portalSendRef.current) {
          latestPublishRef.current = portalSendRef.current(event, recipientId).catch((error) => {
            console.warn("[PortalBridge] Portal publish failed", error);
          });
        } else {
          latestPublishRef.current = new Promise<void>((resolve) => {
            pendingOutboundRef.current.push({ event, recipientId, resolve });
          });
        }
      },
    });
  }

  const dispatch = dispatchRef.current;
  const deliver = useCallback(
    (event: PortalEvent, fallbackId?: string) => {
      const isWithinBudget = event.eventId
        ? isPortalEventWithinBudget(event)
        : isPortalEventWithinBudgetAfterDispatch(event);
      if (!isWithinBudget) {
        console.warn(`[PortalBridge] Ignoring oversized received ${event.type} message`);
        return;
      }
      dispatch.receive(event, fallbackId);
    },
    [dispatch]
  );

  const register = useCallback((handler: EventHandler) => {
    handlerRef.current = handler;
    const pendingEvents = pendingEventsRef.current.splice(0);
    for (const event of pendingEvents) handler(event);
  }, []);

  const unregister = useCallback((handler: EventHandler) => {
    if (handlerRef.current === handler) handlerRef.current = null;
  }, []);

  const eventHandlerCtx = useMemo<EventHandlerContextValue>(
    () => ({ handlerRef, register, unregister, deliver }),
    [deliver, register, unregister]
  );

  const send = useCallback(
    (event: PortalEvent, recipientId?: string): Promise<void> => {
      if (!isPortalEventWithinBudgetAfterDispatch(event)) {
        console.warn(`[PortalBridge] Dropping oversized ${event.type} message before local dispatch`);
        return Promise.resolve();
      }
      dispatch.dispatch(event, recipientId);
      return latestPublishRef.current;
    },
    [dispatch]
  );

  const onSendReady = useCallback((nextSend: (event: PortalEvent, recipientId?: string) => Promise<void>) => {
    portalSendRef.current = nextSend;
    const pending = pendingOutboundRef.current.splice(0);
    for (const { event, recipientId, resolve } of pending) {
      latestPublishRef.current = nextSend(event, recipientId)
        .catch((error) => {
          console.warn("[PortalBridge] Portal publish failed", error);
        })
        .finally(resolve);
    }
  }, []);

  const onConnectionStatusChange = useCallback((status: ChannelStatus) => {
    setConnectionStatus(status);
    if (status === "ready") setConnectionError(undefined);
  }, []);

  const onConnectionError = useCallback((error: PortalError) => {
    setConnectionError({ code: error.code, message: error.message });
  }, []);

  if (!HAS_KEY || !portalClient) {
    return (
      <EventHandlerContext.Provider value={eventHandlerCtx}>
        <LocalFallbackProvider send={send}>
          {children}
        </LocalFallbackProvider>
      </EventHandlerContext.Provider>
    );
  }

  return (
    <PortalProvider client={portalClient}>
      <EventHandlerContext.Provider value={eventHandlerCtx}>
        <PortalContext.Provider value={{ send, connected, detailedPresence, connectionStatus, connectionError }}>
          <ChannelListener
            roomId={roomId}
            metadata={presenceMetadata}
            deliver={deliver}
            onSendReady={onSendReady}
            onConnectionChange={setConnected}
            onConnectionStatusChange={onConnectionStatusChange}
            onConnectionError={onConnectionError}
            onPresenceChange={setDetailedPresence}
          />
          {children}
        </PortalContext.Provider>
      </EventHandlerContext.Provider>
    </PortalProvider>
  );
}

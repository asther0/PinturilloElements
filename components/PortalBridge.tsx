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
import { PortalEvent } from "@/lib/types";
import { PortalProvider, useChannel } from "@portalsdk/react";
import { Portal } from "@portalsdk/core";

const API_KEY = process.env.NEXT_PUBLIC_PORTAL_API_KEY;
const HAS_KEY = Boolean(API_KEY && API_KEY !== "your_portal_api_key_here");

// Create Portal client synchronously if key exists (no network at construction)
const portalClient = HAS_KEY ? new Portal({ apiKey: API_KEY! }) : null;

interface PortalContextValue {
  send: (event: PortalEvent) => void;
  connected: boolean;
}

const PortalContext = createContext<PortalContextValue>({
  send: () => {},
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

function withEventId(event: PortalEvent, fallbackId?: string): PortalEvent {
  if (event.eventId) return event;

  const generatedId =
    globalThis.crypto?.randomUUID?.() ||
    `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return { ...event, eventId: fallbackId || generatedId };
}

function deliverOnce(
  event: PortalEvent,
  handlerRef: MutableRefObject<EventHandler | null>,
  processedEventIds: MutableRefObject<Set<string>>,
  fallbackId?: string
) {
  const handler = handlerRef.current;
  if (!handler) return;

  const normalizedEvent = withEventId(event, fallbackId);
  const eventId = normalizedEvent.eventId;
  if (eventId && processedEventIds.current.has(eventId)) return;
  if (eventId) processedEventIds.current.add(eventId);
  handler(normalizedEvent);
}

interface EventHandlerContextValue {
  handlerRef: MutableRefObject<EventHandler | null>;
}

const EventHandlerContext = createContext<EventHandlerContextValue | null>(null);

export function useRegisterPortalEventHandler(handler: EventHandler) {
  const ctx = useContext(EventHandlerContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.handlerRef.current = handler;
    return () => {
      if (ctx.handlerRef.current === handler) {
        ctx.handlerRef.current = null;
      }
    };
  }, [handler, ctx]);
}

// Local fallback: in-memory event bus when no Portal key is configured
function LocalFallbackProvider({
  children,
  handlerRef,
}: {
  children: ReactNode;
  handlerRef: MutableRefObject<EventHandler | null>;
}) {
  const processedEventIds = useRef(new Set<string>());
  const send = useCallback(
    (event: PortalEvent) => {
      deliverOnce(withEventId(event), handlerRef, processedEventIds);
    },
    [handlerRef]
  );

  return (
    <PortalContext.Provider value={{ send, connected: true }}>
      {children}
    </PortalContext.Provider>
  );
}

// Child component that calls useChannel at its top level (hook rules)
function ChannelListener({
  roomId,
  handlerRef,
  onSendReady,
}: {
  roomId: string;
  handlerRef: MutableRefObject<EventHandler | null>;
  onSendReady: (send: (event: PortalEvent) => void) => void;
}) {
  const processedMessageIds = useRef(new Set<string>());
  const processedEventIds = useRef(new Set<string>());

  // CRITICAL: useChannel called unconditionally at top level
  const { send, messages } = useChannel<string>({
    channelId: `room:${roomId}`,
    metadata: { game: "pinturilloelements", version: "0.1.0" },
    history: 100,
  });

  // Process incoming messages (including history)
  useEffect(() => {
    for (const msg of messages) {
      if (processedMessageIds.current.has(msg.id)) continue;
      processedMessageIds.current.add(msg.id);
      try {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        const event: PortalEvent = JSON.parse(content);
        deliverOnce(event, handlerRef, processedEventIds, msg.id);
      } catch {
        // ignore non-JSON or malformed messages
      }
    }
  }, [messages, handlerRef]);

  // Expose send function to parent. useLayoutEffect guarantees this runs
  // after the component commits, avoiding setState-during-render warnings.
  useLayoutEffect(() => {
    onSendReady((event: PortalEvent) => {
      send({ content: JSON.stringify(withEventId(event)) });
    });
  }, [send, onSendReady]);

  return null;
}

export function PortalBridge({
  children,
  roomId,
}: {
  children: ReactNode;
  roomId: string;
}) {
  const portalSendRef = useRef<((event: PortalEvent) => void) | null>(null);
  const connectedRef = useRef(false);
  const [, forceRender] = useState(0);
  const handlerRef = useRef<EventHandler | null>(null);

  const eventHandlerCtx = useMemo<EventHandlerContextValue>(
    () => ({ handlerRef }),
    [handlerRef]
  );

  const send = useCallback(
    (event: PortalEvent) => {
      portalSendRef.current?.(event);
    },
    []
  );

  const onSendReady = useCallback(
    (nextSend: (event: PortalEvent) => void) => {
      portalSendRef.current = nextSend;
      if (!connectedRef.current) {
        connectedRef.current = true;
        // Schedule a single re-render so the connected flag propagates.
        // We intentionally do NOT call setState during render.
        queueMicrotask(() => forceRender((n) => n + 1));
      }
    },
    []
  );

  if (!HAS_KEY || !portalClient) {
    return (
      <EventHandlerContext.Provider value={eventHandlerCtx}>
        <LocalFallbackProvider handlerRef={handlerRef}>
          {children}
        </LocalFallbackProvider>
      </EventHandlerContext.Provider>
    );
  }

  return (
    <PortalProvider client={portalClient}>
      <EventHandlerContext.Provider value={eventHandlerCtx}>
        <PortalContext.Provider value={{ send, connected: connectedRef.current }}>
          <ChannelListener
            roomId={roomId}
            handlerRef={handlerRef}
            onSendReady={onSendReady}
          />
          {children}
        </PortalContext.Provider>
      </EventHandlerContext.Provider>
    </PortalProvider>
  );
}

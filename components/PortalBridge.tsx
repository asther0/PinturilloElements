"use client";

import {
  createContext,
  useContext,
  useEffect,
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
  const send = useCallback(
    (event: PortalEvent) => {
      const handler = handlerRef.current;
      if (handler) handler(event);
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
  const processedRef = useRef(new Set<string>());

  // CRITICAL: useChannel called unconditionally at top level
  const { send, messages } = useChannel<string>({
    channelId: `room:${roomId}`,
    metadata: { game: "pinturilloelements", version: "0.1.0" },
    history: 100,
  });

  // Process incoming messages (including history)
  useEffect(() => {
    for (const msg of messages) {
      if (processedRef.current.has(msg.id)) continue;
      processedRef.current.add(msg.id);
      try {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        const event: PortalEvent = JSON.parse(content);
        const handler = handlerRef.current;
        if (handler) handler(event);
      } catch {
        // ignore non-JSON or malformed messages
      }
    }
  }, [messages, handlerRef]);

  // Expose send function to parent
  useEffect(() => {
    onSendReady((event: PortalEvent) => {
      send({ content: JSON.stringify(event) });
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
  const [portalSend, setPortalSend] = useState<((event: PortalEvent) => void) | null>(null);
  const handlerRef = useRef<EventHandler | null>(null);

  const eventHandlerCtx = useMemo<EventHandlerContextValue>(
    () => ({ handlerRef }),
    [handlerRef]
  );

  const send = useCallback(
    (event: PortalEvent) => {
      if (portalSend) {
        portalSend(event);
      }
    },
    [portalSend]
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
        <PortalContext.Provider value={{ send, connected: !!portalSend }}>
          <ChannelListener
            roomId={roomId}
            handlerRef={handlerRef}
            onSendReady={setPortalSend}
          />
          {children}
        </PortalContext.Provider>
      </EventHandlerContext.Provider>
    </PortalProvider>
  );
}

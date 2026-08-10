import type { PortalEvent } from "./types";

type RecipientId = string | undefined;
type NormalizedPortalEvent = PortalEvent & { eventId: string };

export interface PortalDispatch {
  dispatch: (event: PortalEvent, recipientId?: RecipientId) => PortalEvent;
  receive: (event: PortalEvent, fallbackId?: string) => boolean;
}

export interface PortalDispatchOptions {
  deliverLocal: (event: PortalEvent) => void;
  publishRemote: (event: PortalEvent, recipientId?: RecipientId) => void;
  createEventId?: () => string;
}

function defaultEventId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `event-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  );
}

function normalizeEvent(
  event: PortalEvent,
  fallbackId: string | undefined,
  createEventId: () => string
): NormalizedPortalEvent {
  if (event.eventId) return event as NormalizedPortalEvent;
  return { ...event, eventId: fallbackId || createEventId() };
}

/**
 * Dispatches local state before publishing and tracks event ids shared by both
 * paths. Portal may not echo persistent messages to the sender, while an echo
 * that does arrive must not apply the event twice.
 */
export function createPortalDispatch({
  deliverLocal,
  publishRemote,
  createEventId = defaultEventId,
}: PortalDispatchOptions): PortalDispatch {
  const processedEventIds = new Set<string>();

  const receive = (event: PortalEvent, fallbackId?: string): boolean => {
    const normalizedEvent = normalizeEvent(event, fallbackId, createEventId);
    const { eventId } = normalizedEvent;
    if (processedEventIds.has(eventId)) return false;

    processedEventIds.add(eventId);
    deliverLocal(normalizedEvent);
    return true;
  };

  const dispatch = (event: PortalEvent, recipientId?: RecipientId): PortalEvent => {
    const normalizedEvent = normalizeEvent(event, undefined, createEventId);
    receive(normalizedEvent);
    publishRemote(normalizedEvent, recipientId);
    return normalizedEvent;
  };

  return { dispatch, receive };
}

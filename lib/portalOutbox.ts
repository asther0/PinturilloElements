export type PortalOutboxSender<Message> = (message: Message) => Promise<unknown>;

export interface PortalOutbox<Message> {
  send: (message: Message) => Promise<void>;
}

/**
 * Serializes persistent Portal publishes. A failed publish rejects its own
 * promise but is absorbed by the queue tail so later messages still publish.
 */
export function createPortalOutbox<Message>(sender: PortalOutboxSender<Message>): PortalOutbox<Message> {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    send(message) {
      const publish = tail.then(() => sender(message));
      tail = publish.catch(() => undefined);
      return publish.then(() => undefined);
    },
  };
}

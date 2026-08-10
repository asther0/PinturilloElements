import { describe, expect, test } from "bun:test";
import { createPortalOutbox } from "../lib/portalOutbox";

interface Deferred<Value> {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
  reject: (reason?: unknown) => void;
}

function deferred<Value>(): Deferred<Value> {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("Portal outbox", () => {
  test("publishes messages one at a time in call order", async () => {
    const started: string[] = [];
    const first = deferred<void>();
    const second = deferred<void>();
    const outbox = createPortalOutbox((message: string) => {
      started.push(message);
      return message === "first" ? first.promise : second.promise;
    });

    const firstPublish = outbox.send("first");
    const secondPublish = outbox.send("second");
    await flushPromises();
    expect(started).toEqual(["first"]);

    first.resolve();
    await flushPromises();
    expect(started).toEqual(["first", "second"]);

    second.resolve();
    await Promise.all([firstPublish, secondPublish]);
  });

  test("continues with later messages after a rejected publish", async () => {
    const started: string[] = [];
    const first = deferred<void>();
    const second = deferred<void>();
    const outbox = createPortalOutbox((message: string) => {
      started.push(message);
      return message === "first" ? first.promise : second.promise;
    });

    const firstPublish = outbox.send("first");
    const secondPublish = outbox.send("second");
    first.reject(new Error("Portal publish failed"));

    await expect(firstPublish).rejects.toThrow("Portal publish failed");
    await flushPromises();
    expect(started).toEqual(["first", "second"]);

    second.resolve();
    await expect(secondPublish).resolves.toBeUndefined();
  });
});

import { describe, expect, test } from "bun:test";
import { createSystemMessage } from "../lib/gameLogic";

describe("createSystemMessage", () => {
  test("creates unique ids when Date.now is frozen", () => {
    const originalNow = Date.now;
    Date.now = () => 1_725_000_000_000;

    try {
      const first = createSystemMessage("primero");
      const second = createSystemMessage("segundo");

      expect(first.timestamp).toBe(second.timestamp);
      expect(first.id).not.toBe(second.id);
      expect(first.id).toMatch(/^system-1725000000000-\d+$/);
      expect(Number(second.id.split("-").at(-1))).toBe(
        Number(first.id.split("-").at(-1)) + 1
      );
    } finally {
      Date.now = originalNow;
    }
  });
});

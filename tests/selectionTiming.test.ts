import { describe, expect, test } from "bun:test";
import { CHOOSE_WORD_TIME_SECONDS, shouldStartChoosingCountdown } from "../lib/gameLogic";

describe("word selection timing", () => {
  test("starts the ten-second countdown only after all three choices arrive", () => {
    expect(CHOOSE_WORD_TIME_SECONDS).toBe(10);
    expect(shouldStartChoosingCountdown([])).toBe(false);
    expect(shouldStartChoosingCountdown(["vercel", "supabase"])).toBe(false);
    expect(shouldStartChoosingCountdown(["vercel", "supabase", "obsidian"])).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import {
  isUiSoundEligible,
  UI_CLICK_SOUND_VOLUME,
  UI_CLICK_TARGET_SELECTOR,
} from "../lib/uiSound";

function target(
  selectorMatches = true,
  attributes: Record<string, string | undefined> = {},
) {
  return {
    matches: (selector: string) => selectorMatches && selector === UI_CLICK_TARGET_SELECTOR,
    hasAttribute: (name: string) => attributes[name] !== undefined,
    getAttribute: (name: string) => attributes[name] ?? null,
  };
}

describe("ui sound feedback", () => {
  test("uses the supported interactive selector at low volume", () => {
    expect(UI_CLICK_TARGET_SELECTOR).toBe('button, a, [role="button"]');
    expect(UI_CLICK_SOUND_VOLUME).toBe(0.22);
  });

  test("plays only eligible interactive targets", () => {
    expect(isUiSoundEligible(target())).toBe(true);
    expect(isUiSoundEligible(target(false))).toBe(false);
    expect(isUiSoundEligible(target(true, { disabled: "" }))).toBe(false);
    expect(isUiSoundEligible(target(true, { "aria-disabled": "true" }))).toBe(false);
    expect(isUiSoundEligible(target(true, { "data-sound": "off" }))).toBe(false);
  });
});

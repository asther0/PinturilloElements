import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  PETDEX_CATALOG,
  PETDEX_INITIAL_VISIBLE_COUNT,
} from "../lib/petdexCatalog";
import {
  getLocalPetdexSoundPath,
  PETDEX_SOUND_VOLUME,
  playPetdexSound,
} from "../lib/petdexSound";

describe("PETDEX_CATALOG", () => {
  test("contains exactly 24 unique pets with checked-in local assets", () => {
    expect(PETDEX_CATALOG).toHaveLength(24);
    expect(new Set(PETDEX_CATALOG.map((pet) => pet.slug)).size).toBe(24);
    expect(new Set(PETDEX_CATALOG.map((pet) => pet.spritesheetPath)).size).toBe(24);
    expect(new Set(PETDEX_CATALOG.map((pet) => pet.localAssetPath)).size).toBe(24);
    expect(PETDEX_INITIAL_VISIBLE_COUNT).toBe(12);

    for (const pet of PETDEX_CATALOG) {
      expect(existsSync(resolve(import.meta.dir, "..", "public", pet.localAssetPath.slice(1)))).toBe(true);
    }
  });

  test("maps the six curated sounds to unique checked-in local assets", () => {
    const petsWithSound = PETDEX_CATALOG.filter((pet) => pet.localSoundPath);

    expect(petsWithSound.map((pet) => pet.slug).sort()).toEqual([
      "doraemon",
      "einstein",
      "nezuko",
      "nezukocoder",
      "noir-webling",
      "shinchan",
    ]);
    expect(new Set(petsWithSound.map((pet) => pet.localSoundPath)).size).toBe(6);
    expect(PETDEX_SOUND_VOLUME).toBe(0.45);

    for (const pet of petsWithSound) {
      expect(pet.soundUrl).toMatch(/^https:\/\/assets\.petdex\.dev\//);
      expect(pet.localSoundPath).toMatch(/^\/petdex-sounds\/.+\.mp3$/);
      expect(getLocalPetdexSoundPath({ spritesheetUrl: pet.spritesheetPath })).toBe(pet.localSoundPath);
      expect(existsSync(resolve(import.meta.dir, "..", "public", pet.localSoundPath!.slice(1)))).toBe(true);
    }

    const silentPet = PETDEX_CATALOG.find((pet) => pet.slug === "capvolt");
    expect(getLocalPetdexSoundPath({ spritesheetUrl: silentPet?.spritesheetPath })).toBeUndefined();
  });

  test("reuses the active audio preview at the configured volume", () => {
    const originalAudio = Object.getOwnPropertyDescriptor(globalThis, "Audio");
    const created: FakeAudio[] = [];

    class FakeAudio {
      src = "";
      volume = 1;
      currentTime = 12;
      pauseCount = 0;

      constructor() {
        created.push(this);
      }

      pause() {
        this.pauseCount++;
      }

      play() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, "Audio", {
      configurable: true,
      value: FakeAudio,
    });

    try {
      const firstPet = PETDEX_CATALOG.find((pet) => pet.slug === "nezukocoder")!;
      const secondPet = PETDEX_CATALOG.find((pet) => pet.slug === "shinchan")!;
      playPetdexSound({ spritesheetUrl: firstPet.spritesheetPath });
      playPetdexSound({ spritesheetUrl: secondPet.spritesheetPath });

      expect(created).toHaveLength(1);
      expect(created[0].pauseCount).toBe(2);
      expect(created[0].src).toBe(secondPet.localSoundPath);
      expect(created[0].volume).toBe(PETDEX_SOUND_VOLUME);
      expect(created[0].currentTime).toBe(0);
    } finally {
      if (originalAudio) {
        Object.defineProperty(globalThis, "Audio", originalAudio);
      } else {
        delete (globalThis as { Audio?: unknown }).Audio;
      }
    }
  });
});

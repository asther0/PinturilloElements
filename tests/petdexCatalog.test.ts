import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  PETDEX_CATALOG,
  PETDEX_INITIAL_VISIBLE_COUNT,
} from "../lib/petdexCatalog";

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
});

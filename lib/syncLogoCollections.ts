#!/usr/bin/env bun
/**
 * Sync utility for TryElements logo collections.
 *
 * Fetches the live RSC payload from https://www.tryelements.dev/docs/logos?view=collections
 * to extract official collection definitions, and validates membership slugs against
 * the canonical 206-logo index at https://www.tryelements.dev/r/logos-index.json.
 *
 * Generates lib/logoCollections.ts as a typed checked-in snapshot.
 * Builds and gameplay do not depend on runtime CORS or network.
 *
 * Run: bun run lib/syncLogoCollections.ts
 */

const RSC_URL = "https://www.tryelements.dev/docs/logos?view=collections";
const INDEX_URL = "https://www.tryelements.dev/r/logos-index.json";
const OUTPUT_PATH = "lib/logoCollections.ts";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

function extractBundles(html: string): Array<{
  id: string;
  title: string;
  logoCount: number;
  dependencies: string[];
}> {
  const searchTerm = '\\"bundles\\":[';
  const idx = html.indexOf(searchTerm);
  if (idx === -1) {
    throw new Error("Could not find bundles array in RSC payload");
  }

  const start = idx + searchTerm.length;

  // Extract array content by tracking [] depth
  let arrayContent = "";
  let depth = 1;
  let inString = false;
  let escape = false;

  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (escape) {
      escape = false;
      arrayContent += c;
      continue;
    }
    if (c === "\\") {
      escape = true;
      arrayContent += c;
      continue;
    }
    if (c === '"' && !escape) {
      inString = !inString;
      arrayContent += c;
      continue;
    }
    if (!inString) {
      if (c === "[") {
        depth++;
        arrayContent += c;
      } else if (c === "]") {
        depth--;
        if (depth === 0) {
          break;
        }
        arrayContent += c;
      } else {
        arrayContent += c;
      }
    } else {
      arrayContent += c;
    }
  }

  // Unescape quotes: \" -> "
  const fixed = arrayContent.replace(/\\"/g, '"');

  // Parse as JSON array
  const bundles = JSON.parse("[" + fixed + "]") as Array<{
    id: string;
    title: string;
    logoCount: number;
    dependencies: string[];
  }>;

  return bundles;
}

async function main() {
  console.log("Fetching logo index...");
  const catalog = await fetchJson<string[]>(INDEX_URL);
  console.log(`  -> ${catalog.length} slugs`);

  console.log("Fetching RSC payload...");
  const html = await fetchText(RSC_URL);
  console.log(`  -> ${html.length} bytes`);

  console.log("Extracting bundles...");
  const bundles = extractBundles(html);
  console.log(`  -> ${bundles.length} bundles`);

  // Filter out the generic "logos" (Brand Logos Collection) which is a
  // partial subset; the open catalog is the full 206-slug list.
  const collections = bundles
    .filter((b) => b.id !== "logos")
    .map((b) => {
      const slugs = b.dependencies.map((d) =>
        d.replace("@elements/", "").replace("-logo", "")
      );

      // Validate: every slug must exist in the canonical catalog
      const missing = slugs.filter((s) => !catalog.includes(s));
      if (missing.length > 0) {
        console.warn(
          `  WARN [${b.id}] missing from catalog: ${missing.join(", ")}`
        );
      }

      return {
        id: b.id,
        label: b.title,
        words: slugs,
      };
    });

  console.log(`  -> ${collections.length} collections after filtering`);

  // Generate the snapshot file
  const catalogLines = [];
  for (let i = 0; i < catalog.length; i += 10) {
    const batch = catalog.slice(i, i + 10);
    catalogLines.push(
      '  ' + batch.map((s) => `"${s}"`).join(",") + ","
    );
  }

  const collectionBlocks = collections.map((c) => {
    const wordLines = [];
    for (let i = 0; i < c.words.length; i += 10) {
      const batch = c.words.slice(i, i + 10);
      wordLines.push("      " + batch.map((s) => `"${s}"`).join(","));
    }
    return `  {
    id: "${c.id}",
    label: "${c.label}",
    words: [
${wordLines.join(",\n")},
    ],
  },`;
  });

  const fileContent = `export type LogoCollection = {
  id: string;
  label: string;
  words: string[];
};

// Open logo catalog: all TryElements logos from the public index at
// https://www.tryelements.dev/r/logos-index.json (${catalog.length} slugs). Embedded here
// so the game never depends on a runtime fetch or a small fallback catalog.
export const LOGO_CATALOG: string[] = [
${catalogLines.join("\n")}
];

// TryElements official logo collections extracted from the live RSC payload at
// https://www.tryelements.dev/docs/logos?view=collections.
// Each collection maps to a subset of the ${catalog.length}-slug LOGO_CATALOG.
// When multiple collections are selected, memberships are deduplicated.
// "open" (Catalogo abierto) is the mutually exclusive default: all ${catalog.length} logos.
export const LOGO_COLLECTIONS: LogoCollection[] = [
${collectionBlocks.join("\n")}
];
`;

  const fs = await import("node:fs");
  fs.writeFileSync(OUTPUT_PATH, fileContent, "utf-8");
  console.log(`\nWrote ${OUTPUT_PATH}`);

  // Summary
  console.log("\nCollections:");
  for (const c of collections) {
    console.log(`  ${c.id}: ${c.label} (${c.words.length} logos)`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err.message || err);
  process.exit(1);
});

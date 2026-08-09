import { PETDEX_CATALOG_BY_SPRITESHEET } from "@/lib/petdexCatalog";

const PETDEX_IMAGE_WIDTH = 750;
const PETDEX_IMAGE_QUALITY = 60;

function isPetdexSpriteSource(sourceUrl: string): boolean {
  try {
    const parsed = new URL(sourceUrl);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "assets.petdex.dev" &&
      parsed.pathname.startsWith("/pets/")
    );
  } catch {
    return false;
  }
}

// Curated sprite URLs resolve to checked-in static assets. Other trusted
// Petdex sprites retain the previous optimizer behavior, while untrusted URLs
// pass through unchanged for the existing caller-side validation flow.
export function petdexSpriteSrc(sourceUrl: string): string {
  const catalogPet = PETDEX_CATALOG_BY_SPRITESHEET.get(sourceUrl);
  if (catalogPet) return catalogPet.localAssetPath;
  if (!isPetdexSpriteSource(sourceUrl)) return sourceUrl;
  const encodedUrl = encodeURIComponent(sourceUrl);
  return `/_next/image?url=${encodedUrl}&w=${PETDEX_IMAGE_WIDTH}&q=${PETDEX_IMAGE_QUALITY}`;
}

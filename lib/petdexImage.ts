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

// Returns the local Next.js image optimizer URL for a Petdex spritesheet.
// Callers are expected to have validated the source already; this function
// re-validates defensively and returns the original source unchanged when it
// is not a trusted assets.petdex.dev sprite, preserving prior rendering.
export function petdexSpriteSrc(sourceUrl: string): string {
  if (!isPetdexSpriteSource(sourceUrl)) return sourceUrl;
  const encodedUrl = encodeURIComponent(sourceUrl);
  return `/_next/image?url=${encodedUrl}&w=${PETDEX_IMAGE_WIDTH}&q=${PETDEX_IMAGE_QUALITY}`;
}
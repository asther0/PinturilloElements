const TRY_ELEMENTS_LOGO_ENDPOINT = "https://www.tryelements.dev/api/logos";

/**
 * Return the official TryElements SVG endpoint for any catalog slug.
 */
export function tryElementsLogoUrl(slug: string): string {
  return `${TRY_ELEMENTS_LOGO_ENDPOINT}?name=${encodeURIComponent(slug.toLowerCase())}`;
}

const TRY_ELEMENTS_LOGO_ENDPOINT = "https://www.tryelements.dev/api/logos";
const SAFE_TRY_ELEMENTS_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSafeTryElementsSlug(slug: string): boolean {
  return SAFE_TRY_ELEMENTS_SLUG.test(slug);
}

/**
 * Return the same-origin logo route only for catalog-style slugs. Keeping
 * this check shared with the route prevents a client-controlled proxy URL.
 */
export function tryElementsLogoProxyUrl(slug: string): string | null {
  const normalizedSlug = slug.toLowerCase();
  return isSafeTryElementsSlug(normalizedSlug)
    ? `/api/logos/${encodeURIComponent(normalizedSlug)}`
    : null;
}

/**
 * Return the official TryElements SVG endpoint for any catalog slug.
 */
export function tryElementsLogoUrl(slug: string): string {
  return `${TRY_ELEMENTS_LOGO_ENDPOINT}?name=${encodeURIComponent(slug.toLowerCase())}`;
}

type Rgb = readonly [number, number, number];

const NEAR_WHITE_CHANNEL = 245;
const PAINT_ATTRIBUTE = /\b(fill|stroke)\s*=\s*(["'])(.*?)\2/gi;
const PAINT_STYLE = /\b(fill|stroke)\s*:\s*([^;"'}]+)/gi;
const ACTIVE_SVG_ELEMENT = /<(script|foreignobject|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi;
const ACTIVE_SVG_TAG = /<(script|foreignobject|iframe|object|embed)\b[^>]*\/?\s*>/gi;
const INLINE_EVENT_HANDLER = /\s+on[a-z][\w:.-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?/gi;
const SVG_HREF = /\s+(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

export const LOGO_SVG_RESPONSE_HEADERS = {
  "Content-Type": "image/svg+xml; charset=utf-8",
  "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; img-src 'none'; object-src 'none'; script-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
} as const;

function parsePaint(value: string): Rgb | null | undefined {
  const paint = value.trim().toLowerCase();
  if (paint === "none" || paint === "transparent") return null;
  if (paint === "white") return [255, 255, 255];

  const hex = paint.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const parseChannel = (channel: string) => Number.parseInt(channel, 16);
    return hex.length <= 4
      ? [parseChannel(hex[0] + hex[0]), parseChannel(hex[1] + hex[1]), parseChannel(hex[2] + hex[2])]
      : [parseChannel(hex.slice(0, 2)), parseChannel(hex.slice(2, 4)), parseChannel(hex.slice(4, 6))];
  }

  const rgb = paint.match(/^rgba?\(\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/);
  if (rgb) {
    const isPercentage = paint.includes("%");
    const parseChannel = (channel: string) => {
      const value = Number.parseFloat(channel);
      return isPercentage ? Math.round(value * 2.55) : value;
    };
    return [parseChannel(rgb[1]), parseChannel(rgb[2]), parseChannel(rgb[3])];
  }

  return undefined;
}

function explicitPaintValues(svg: string): string[] {
  const values: string[] = [];
  for (const expression of [PAINT_ATTRIBUTE, PAINT_STYLE]) {
    expression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(svg))) values.push(match[3] ?? match[2]);
  }
  return values;
}

function isNearWhite([red, green, blue]: Rgb): boolean {
  return red >= NEAR_WHITE_CHANNEL && green >= NEAR_WHITE_CHANNEL && blue >= NEAR_WHITE_CHANNEL;
}

function isLocalSvgReference(value: string): boolean {
  return value.trim().startsWith("#");
}

/**
 * Removes executable SVG content and references that can fetch a remote
 * resource. Fragment references remain so ordinary defs and use markup work.
 */
export function sanitizeLogoSvg(svg: string): string {
  return svg
    .replace(ACTIVE_SVG_ELEMENT, "")
    .replace(ACTIVE_SVG_TAG, "")
    .replace(INLINE_EVENT_HANDLER, "")
    .replace(SVG_HREF, (match, doubleQuoted?: string, singleQuoted?: string, unquoted?: string) => {
      const reference = doubleQuoted ?? singleQuoted ?? unquoted ?? "";
      return isLocalSvgReference(reference) ? match : "";
    });
}

/**
 * Makes monochrome near-white SVG logos legible on a light card without
 * changing multicolor or currentColor-based artwork.
 */
export function normalizeLogoContrast(svg: string): string {
  const paints = explicitPaintValues(svg);
  if (paints.length === 0 || paints.some((paint) => paint.trim().toLowerCase() === "currentcolor")) {
    return svg;
  }

  const parsed = paints.map(parsePaint);
  if (parsed.some((paint) => paint === undefined) || !parsed.some((paint) => paint !== null)) return svg;
  if (!parsed.filter((paint): paint is Rgb => paint !== null).every(isNearWhite)) return svg;

  return svg
    .replace(PAINT_ATTRIBUTE, (_match, property: string, quote: string) => `${property}=${quote}#111111${quote}`)
    .replace(PAINT_STYLE, (match) => match.replace(/:\s*[^;"'}]+/, ": #111111"));
}

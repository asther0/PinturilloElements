import {
  LOGO_SVG_RESPONSE_HEADERS,
  normalizeLogoContrast,
  sanitizeLogoSvg,
} from "@/lib/logoContrast";
import { isSafeTryElementsSlug, tryElementsLogoUrl } from "@/lib/tryElementsLogo";

export const revalidate = 86400;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!isSafeTryElementsSlug(slug)) {
    return Response.json({ error: "Invalid logo slug" }, { status: 400 });
  }

  try {
    const upstream = await fetch(tryElementsLogoUrl(slug), {
      headers: { Accept: "image/svg+xml" },
      next: { revalidate },
    });
    if (!upstream.ok) {
      return Response.json({ error: "Logo unavailable" }, { status: upstream.status });
    }

    const svg = await upstream.text();
    if (!/<svg\b/i.test(svg)) {
      return Response.json({ error: "Invalid logo response" }, { status: 502 });
    }

    return new Response(normalizeLogoContrast(sanitizeLogoSvg(svg)), {
      headers: LOGO_SVG_RESPONSE_HEADERS,
    });
  } catch {
    return Response.json({ error: "Logo unavailable" }, { status: 502 });
  }
}

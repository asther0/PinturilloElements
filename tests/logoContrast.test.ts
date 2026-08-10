import { describe, expect, test } from "bun:test";
import {
  LOGO_SVG_RESPONSE_HEADERS,
  normalizeLogoContrast,
  sanitizeLogoSvg,
} from "../lib/logoContrast";
import { isSafeTryElementsSlug, tryElementsLogoProxyUrl } from "../lib/tryElementsLogo";
import { GET as getLogo } from "../app/api/logos/[slug]/route";

describe("normalizeLogoContrast", () => {
  test("turns an all-near-white explicitly painted logo dark", () => {
    const svg = '<svg><path fill="#fff" stroke="rgb(250, 250, 250)" /></svg>';

    expect(normalizeLogoContrast(svg)).toBe(
      '<svg><path fill="#111111" stroke="#111111" /></svg>'
    );
  });

  test("preserves multicolor and currentColor artwork", () => {
    const multicolor = '<svg><path fill="#fff" /><path fill="#3fc9b6" /></svg>';
    const currentColor = '<svg><path fill="currentColor" /></svg>';

    expect(normalizeLogoContrast(multicolor)).toBe(multicolor);
    expect(normalizeLogoContrast(currentColor)).toBe(currentColor);
  });

  test("still normalizes an all-white logo after sanitization", () => {
    const svg = '<svg onload="alert(1)"><path fill="#fff" stroke="#fafafa" /></svg>';

    expect(normalizeLogoContrast(sanitizeLogoSvg(svg))).toBe(
      '<svg><path fill="#111111" stroke="#111111" /></svg>'
    );
  });
});

describe("sanitizeLogoSvg", () => {
  test("removes executable SVG content and external references", () => {
    const svg = [
      '<svg onload="alert(1)">',
      '<script>alert(1)</script><foreignObject><body>unsafe</body></foreignObject>',
      '<iframe src="https://evil.example"></iframe><object data="https://evil.example"></object><embed src="x" />',
      '<path fill="currentColor" stroke="#123456" onclick="alert(1)" onfocus=alert(2)',
      ' href="https://evil.example/logo.svg" xlink:href="//evil.example/logo.svg" />',
      '<use href="#safe-symbol" />',
      '</svg>',
    ].join("");

    const sanitized = sanitizeLogoSvg(svg);

    expect(sanitized).not.toMatch(/<\/?(?:script|foreignObject|iframe|object|embed)\b/i);
    expect(sanitized).not.toMatch(/\son\w+\s*=/i);
    expect(sanitized).not.toContain("evil.example");
    expect(sanitized).toContain('fill="currentColor"');
    expect(sanitized).toContain('stroke="#123456"');
    expect(sanitized).toContain('href="#safe-symbol"');
  });

  test("preserves ordinary path markup and local fragment references", () => {
    const svg = '<svg><path d="M0 0" fill="#123456" stroke="currentColor" /><use xlink:href="#mark" /></svg>';

    expect(sanitizeLogoSvg(svg)).toBe(svg);
  });

  test("sets restrictive SVG response headers", () => {
    expect(LOGO_SVG_RESPONSE_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(LOGO_SVG_RESPONSE_HEADERS["Content-Security-Policy"]).toContain("sandbox");
    expect(LOGO_SVG_RESPONSE_HEADERS["Content-Security-Policy"]).toContain("default-src 'none'");
  });

  test("the proxy returns a sanitized SVG with its restrictive headers", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(
      '<svg onload="alert(1)"><script>alert(1)</script><path fill="#fff" href="https://evil.example" /></svg>'
    );

    try {
      const response = await getLogo(new Request("https://example.test/api/logos/vercel"), {
        params: Promise.resolve({ slug: "vercel" }),
      });

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('<svg><path fill="#111111" /></svg>');
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("TryElements proxy paths", () => {
  test("accepts catalog-style slugs and rejects unsafe URL input", () => {
    expect(isSafeTryElementsSlug("aws-cognito")).toBe(true);
    expect(tryElementsLogoProxyUrl("aws-cognito")).toBe("/api/logos/aws-cognito");
    expect(isSafeTryElementsSlug("../secret")).toBe(false);
    expect(isSafeTryElementsSlug("a&b")).toBe(false);
    expect(tryElementsLogoProxyUrl("../secret")).toBeNull();
  });
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep dev and production build artifacts separate. A concurrent `next build`
  // must never replace chunks that a running `next dev` server still requires.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.petdex.dev",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/petdex-api/pets/search",
        destination: "https://petdex.dev/api/pets/search",
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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

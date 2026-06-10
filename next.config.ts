import path from "node:path";
import type { NextConfig } from "next";

// Only the production deployment should be indexable. Preview/development
// deployments get an authoritative `X-Robots-Tag: noindex` on every route —
// stronger than robots.txt, since it suppresses indexing even for URLs
// discovered from other sources (e.g. leaked Vercel preview URLs).
const isProduction = process.env.VERCEL_ENV === "production";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project directory. Without this,
  // Next auto-detects multiple lockfiles (e.g. a stray ~/package-lock.json)
  // and may infer the wrong root, which breaks module resolution.
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    if (isProduction) {
      return [];
    }

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

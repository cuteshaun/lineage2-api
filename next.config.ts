import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project directory. Without this,
  // Next auto-detects multiple lockfiles (e.g. a stray ~/package-lock.json)
  // and may infer the wrong root, which breaks module resolution.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Monorepo: point Turbopack to the repo root to avoid lockfile ambiguity
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;

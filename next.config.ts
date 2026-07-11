import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  // Static export: Electron loads `out/` over the custom `app://` protocol in
  // production (see electron/main.js). No Node server ever runs.
  output: "export",
  images: { unoptimized: true },
  // Pin the workspace root to THIS folder. Without it, Next infers the parent
  // dir (two lockfiles) as root — so Tailwind scans sibling/build folders like
  // `out/` and re-emits stale utility CSS (broke Turbopack's CSS parser on the
  // shadcn chart's `[stroke='#ccc']` classes). Pinning it also honours our
  // .gitignore (out/, .next/) during content detection.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  experimental: {
    // Tree-shake barrel imports from these packages so only used modules ship.
    optimizePackageImports: ["radix-ui", "date-fns", "lucide-react"],
  },
};

export default nextConfig;

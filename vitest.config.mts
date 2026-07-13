// .mts, not .ts — and that matters.
//
// Vite 7 is ESM-only, but this package.json has no `"type": "module"` and must
// not have one: electron/main.js is CommonJS and the Electron entry point would
// stop loading. Without that field, Vite bundles a `.ts` config as CommonJS,
// which then `require()`s an ESM vite and dies with ERR_REQUIRE_ESM.
//
// The `.mts` extension says "this file is ESM" regardless of package.json, which
// is exactly the escape hatch this situation needs. Do not rename it back.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

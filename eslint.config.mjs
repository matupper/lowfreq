import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendor files copied verbatim by scripts/copy-maplibre-worker.js
    // (postinstall) — see that script and EventMap.tsx's setWorkerUrl call.
    "public/maplibre-gl-worker.mjs",
    "public/maplibre-gl-shared.mjs",
    // Plain CommonJS build tooling, not app source.
    "scripts/**",
  ]),
]);

export default eslintConfig;

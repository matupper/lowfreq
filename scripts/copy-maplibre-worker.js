// maplibre-gl computes its worker script URL from `import.meta.url` at
// runtime (see node_modules/maplibre-gl/dist/maplibre-gl-dev.mjs's
// defaultWorkerUrl()), which only resolves correctly when the module was
// loaded from a plain http(s) URL. Turbopack's code-splitting for
// dynamically-imported chunks (EventMap.tsx is loaded via next/dynamic)
// doesn't preserve that, so the computed URL falls back to "" and maplibre
// silently constructs `new Worker("", { type: "module" })` — the current
// HTML page fails to parse as a JS module, the worker never runs, and every
// tile sits in "loading" forever with no error surfaced anywhere (map blank,
// no pins, network shows the style/tiles.json/sprite requests succeeding).
//
// The fix is EventMap.tsx calling maplibre's own setWorkerUrl() with a
// stable, bundler-independent path instead of relying on the broken
// default. This script copies the matching worker bundle out of
// node_modules into public/ so that path is servable; it runs on every
// `npm install` so it can't drift from the installed maplibre-gl version.
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "node_modules", "maplibre-gl", "dist");
const publicDir = path.join(__dirname, "..", "public");

// The worker bundle itself imports a sibling chunk (shared code between the
// main thread and worker bundles) by relative path, so both files have to
// live at the same public/ path for that import to resolve.
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  fs.copyFileSync(path.join(distDir, file), path.join(publicDir, file));
}

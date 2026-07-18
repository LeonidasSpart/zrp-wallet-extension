import * as esbuild from "esbuild";
import { mkdirSync } from "fs";

mkdirSync("dist", { recursive: true });

// Only the background service worker is allowed to be an ES module
// (declared via "type": "module" in manifest.json). Content scripts and
// the popup script run as classic scripts, so they must be bundled as IIFE.
const entryPoints = [
  { in: "src/background.js", out: "background", format: "esm" },
  { in: "src/content-script.js", out: "content-script", format: "iife" },
  { in: "src/inject.js", out: "inject", format: "iife" },
  { in: "src/popup/popup.js", out: "popup", format: "iife" },
];

for (const entry of entryPoints) {
  await esbuild.build({
    entryPoints: [entry.in],
    bundle: true,
    minify: true,
    format: entry.format,
    platform: "browser",
    target: "chrome111",
    outfile: `dist/${entry.out}.js`,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  console.log(`built dist/${entry.out}.js (${entry.format})`);
}

console.log("Build complete.");

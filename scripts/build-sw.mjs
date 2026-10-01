/**
 * Bundle src/pwa/sw.ts into public/sw.js (classic worker, no extra runtime dependency).
 * esbuild is already installed via tsx, which the test and seed scripts use.
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

const require = createRequire(import.meta.url);

let esbuild;
try {
  esbuild = require("esbuild");
} catch {
  console.error("esbuild is missing. Run npm install so the tsx toolchain is present, then retry.");
  process.exit(1);
}

await mkdir(new URL("../public/", import.meta.url), { recursive: true });

await esbuild.build({
  entryPoints: ["src/pwa/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  format: "iife",
  target: ["es2020"],
  platform: "browser",
  minify: false,
  legalComments: "none",
  banner: {
    js: [
      "/*",
      " * Rangach service worker. Generated from src/pwa/sw.ts — edit that file, then",
      " * run `node scripts/build-sw.mjs` (also runs from npm run build and build:vercel).",
      " *",
      " * Kill switch: set SW_MODE to \"kill\" in src/pwa/sw.ts and deploy.",
      " * The replacement worker deletes caches, unregisters itself, and reloads open tabs.",
      " * /sw.js is served with Cache-Control: no-store so the browser cannot keep a bad copy.",
      " */",
    ].join("\n"),
  },
});

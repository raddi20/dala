import { readFileSync } from "node:fs";

/**
 * Chunks the layout already prints as <script> tags. The error boundary's own
 * chunk is not one of them. The flight client (React module) loads it with a
 * script element created from JavaScript. That load is required to finish the
 * page. When it fails, WebKit logs
 * ChunkLoadError: Failed to load chunk … from module 964893
 * and the global error screen replaces the page.
 */
const LAYOUT_ENTRY = "[project]/src/app/layout";
const EXTRA_ENTRIES = ["[project]/src/app/error", "[project]/src/app/global-error", "[project]/src/app/not-found"];

export function scriptHref(file: string): string {
  const clean = file.replace(/^\/+/, "");
  if (clean.startsWith("_next/")) return `/${clean}`;
  return `/_next/${clean}`;
}

/** Script URLs the initial HTML should include so the flight client does not insert them later. */
export function earlyScriptSrcs(entryJSFiles: Record<string, readonly string[] | undefined>): string[] {
  const present = new Set(entryJSFiles[LAYOUT_ENTRY] ?? []);
  const extra: string[] = [];
  for (const key of EXTRA_ENTRIES) {
    for (const file of entryJSFiles[key] ?? []) {
      if (!file.endsWith(".js") || present.has(file)) continue;
      const href = scriptHref(file);
      if (!extra.includes(href)) extra.push(href);
    }
  }
  return extra;
}

let cached: string[] | null = null;

/** Read after `next build`. Dev does not split these chunks the same way, so it adds none. */
export function readEarlyScriptSrcs(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  if (cached) return cached;
  try {
    const text = readFileSync(".next/server/app/page_client-reference-manifest.js", "utf8");
    const entry = extractEntryJSFiles(text);
    cached = entry ? earlyScriptSrcs(entry) : [];
  } catch {
    cached = [];
  }
  return cached;
}

function extractEntryJSFiles(text: string): Record<string, string[]> | null {
  const token = '"entryJSFiles":';
  const at = text.indexOf(token);
  if (at < 0) return null;
  const brace = text.indexOf("{", at);
  if (brace < 0) return null;
  let depth = 0;
  for (let i = brace; i < text.length; i += 1) {
    const char = text[i];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(text.slice(brace, i + 1)) as Record<string, string[]>;
      }
    }
  }
  return null;
}

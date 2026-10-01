import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(import.meta.dirname, "..", "..", "..");

function files(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "public") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(path);
  }
}

test("provider SDKs are imported only from the AI layer", () => {
  const found: string[] = [];
  files(join(root, "src"), found);
  files(join(root, "scripts"), found);
  const offenders: string[] = [];
  for (const path of found) {
    const allowed = path.includes(`${join("src", "lib", "ai")}${path.includes("\\") ? "\\" : "/"}`) || path.includes(join("scripts", "ai-eval"));
    if (allowed) continue;
    const text = readFileSync(path, "utf8");
    if (text.includes("@google/genai") || /from ["']openai["']/.test(text)) offenders.push(path);
  }
  assert.deepEqual(offenders, []);
});

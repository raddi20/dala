import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HOME_ASK_PLACEHOLDER, HOME_CATEGORY_CHIPS, HOME_PROMPTS, homePromptHref } from "@/lib/home-prompts";

test("home prompt chips and the placeholder do not mention a funeral", () => {
  const text = [HOME_ASK_PLACEHOLDER, ...HOME_PROMPTS.flatMap((prompt) => [prompt.label, prompt.query])].join("\n");
  assert.equal(/funeral/i.test(text), false);
  assert.equal(HOME_PROMPTS.length >= 4, true);
  assert.match(homePromptHref(HOME_PROMPTS[0].query), /^\/listings\?nl=/);
  assert.equal(HOME_CATEGORY_CHIPS.length, 8);
  assert.equal(HOME_CATEGORY_CHIPS[0]?.href, "/listings");
  assert.equal(HOME_CATEGORY_CHIPS.at(-1)?.href, "/shops");

  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /HOME_PROMPTS/);
  assert.match(page, /HOME_ASK_PLACEHOLDER/);
  assert.equal(/funeral/i.test(page), false);
});

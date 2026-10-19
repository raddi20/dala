import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LanguageSwitchSlot } from "@/components/language-switch";
import { dholuoUiOn, langFromCookie, persistLangCookie, readLangCookie } from "@/lib/i18n/lang";
import { UI_STRINGS, dholuoStringsMarkdown, uiText } from "@/lib/i18n/strings";
import { HOME_ASK_PLACEHOLDER, HOME_PROMPTS } from "@/lib/home-prompts";
import { DIASPORA_ORDERS_LABEL } from "@/lib/diaspora";

const off = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
const on = { NODE_ENV: "test", NEXT_PUBLIC_DHOLUO_UI: "on" } as NodeJS.ProcessEnv;

test("the language cookie is remembered and the flag off stays English", () => {
  assert.equal(dholuoUiOn(off), false);
  assert.equal(dholuoUiOn(on), true);
  assert.equal(dholuoUiOn({ NODE_ENV: "test", NEXT_PUBLIC_DHOLUO_UI: "" } as NodeJS.ProcessEnv), false);
  assert.equal(langFromCookie(undefined, on), "en");
  assert.equal(langFromCookie("dholuo", off), "en");
  assert.equal(langFromCookie("nope", on), "en");

  const header = persistLangCookie("dholuo");
  assert.match(header, /rangach_lang=dholuo/);
  assert.match(header, /Path=\//);
  assert.equal(langFromCookie(readLangCookie(header), on), "dholuo");
  assert.equal(langFromCookie(readLangCookie(persistLangCookie("en")), on), "en");
  assert.equal(langFromCookie(readLangCookie(header), off), "en");
});

test("the Dholuo option is hidden while the flag is off", () => {
  const hidden = renderToStaticMarkup(createElement(LanguageSwitchSlot, { enabled: dholuoUiOn(off), lang: "en" }));
  assert.equal(hidden.includes("Dholuo"), false);

  const shown = renderToStaticMarkup(createElement(LanguageSwitchSlot, { enabled: dholuoUiOn(on), lang: "en" }));
  assert.match(shown, /EN/);
  assert.match(shown, /Dholuo/);
  const header = readFileSync(new URL("../../components/header.tsx", import.meta.url), "utf8");
  assert.match(header, /dholuoUiOn\(\)/);
  assert.match(header, /LanguageSwitchControl/);
});

test("every English key has a Dholuo line and the copy stays clean", () => {
  const keys = Object.keys(UI_STRINGS);
  assert.ok(keys.length > 20);
  for (const key of keys) {
    const row = UI_STRINGS[key as keyof typeof UI_STRINGS];
    assert.equal(row.draft, key.startsWith("hear_"), key);
    assert.ok(row.en.trim(), key);
    assert.ok(row.dholuo.trim(), key);
    assert.equal(/funeral/i.test(row.en), false, key);
    assert.equal(/funeral/i.test(row.dholuo), false, key);
    assert.equal(/escrow/i.test(row.en), false, key);
    assert.equal(/escrow/i.test(row.dholuo), false, key);
  }
  assert.equal(uiText("en", "understood"), "Rangach understood");
  assert.equal(uiText("dholuo", "understood"), UI_STRINGS.understood.dholuo);
  assert.equal(uiText("en", "ask_placeholder"), HOME_ASK_PLACEHOLDER);
  assert.equal(uiText("en", "prompt_ayie"), HOME_PROMPTS[0].label);
  assert.equal(uiText("en", "diaspora_orders"), DIASPORA_ORDERS_LABEL);
  assert.match(uiText("en", "home_ask_sub"), /Kenya, East Africa and the Diaspora/);
  assert.equal(uiText("dholuo", "home_draft_help"), "Rangach nyalo ndiko ni weche mag listing");
  assert.equal(uiText("dholuo", "no_offerings"), "Onge Duka");
  assert.equal(uiText("dholuo", "type_for_sale"), "Sale");
  const doc = readFileSync(new URL("../../../docs/dholuo-ui-strings.md", import.meta.url), "utf8");
  assert.equal(doc, dholuoStringsMarkdown());
  for (const key of keys) assert.match(doc, new RegExp(`\\| ${key} \\|`));
});

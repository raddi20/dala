import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TourPromptCard } from "@/components/tour-prompt";
import { UI_STRINGS, uiText } from "@/lib/i18n/strings";
import { readTourDeclined, tourEntry, tourPromptKey, writeTourDeclined } from "@/lib/tour";

function memoryStore() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
}

const firstVisit = { path: "/", flag: true, force: false, seen: false, activeRun: false, accepted: false, declined: false };

test("a first visit gets the invite instead of an automatic tour", () => {
  assert.equal(tourEntry(firstVisit), "prompt");
  assert.equal(tourEntry({ ...firstVisit, path: "/listings" }), "prompt");
  assert.equal(tourEntry({ ...firstVisit, path: "/admin" }), "none");
  assert.equal(tourEntry({ ...firstVisit, flag: false }), "none");
});

test("Not now is remembered on the device and the invite is not asked again", () => {
  const store = memoryStore();
  assert.equal(readTourDeclined(store, "visitor"), false);
  writeTourDeclined(store, "visitor");
  assert.equal(store.getItem(tourPromptKey("visitor")), "no");
  const declined = readTourDeclined(store, "visitor");
  assert.equal(declined, true);
  assert.equal(tourEntry({ ...firstVisit, declined }), "none");
  // The seller invite is separate.
  assert.equal(readTourDeclined(store, "seller"), false);
  // A store that throws (private mode) does not break the page.
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readTourDeclined(broken, "visitor"), false);
  writeTourDeclined(broken, "visitor");
});

test("Yes starts the tour, and a replay after Not now still works", () => {
  assert.equal(tourEntry({ ...firstVisit, accepted: true }), "tour");
  // Replay (footer Show me around, or Sulwe chat) sets accepted, so it starts even after Not now.
  assert.equal(tourEntry({ ...firstVisit, declined: true, accepted: true }), "tour");
});

test("finishing or skipping the tour stops the invite", () => {
  assert.equal(tourEntry({ ...firstVisit, seen: true }), "none");
  assert.equal(tourEntry({ ...firstVisit, seen: true, accepted: true }), "none");
});

test("?tour=1 and a tour already walking across pages skip the invite", () => {
  assert.equal(tourEntry({ ...firstVisit, force: true }), "tour");
  assert.equal(tourEntry({ ...firstVisit, force: true, seen: true, declined: true }), "tour");
  assert.equal(tourEntry({ ...firstVisit, flag: false, force: true }), "tour");
  assert.equal(tourEntry({ ...firstVisit, activeRun: true, declined: true }), "tour");
});

test("the invite card renders both buttons, in English and Dholuo, above Sulwe and the nav", () => {
  const noop = () => undefined;
  const en = renderToStaticMarkup(createElement(TourPromptCard, { lang: "en", withSulwe: true, onYes: noop, onNo: noop }));
  assert.match(en, /Hi! Want a quick tour\?/);
  assert.match(en, /Quick tour\?/);
  assert.match(en, /Yes, show me/);
  assert.match(en, /Not now/);
  assert.match(en, /role="dialog"/);
  assert.match(en, /aria-modal="false"/);
  assert.match(en, /data-tour-prompt-tail/);
  assert.match(en, /-bottom-\[7px\]/);
  assert.match(en, /h-11/);
  assert.match(en, /bg-white/);
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.tour-prompt \{[^}]*height: 44px/);
  assert.match(css, /\.tour-prompt \{[^}]*right: 12px/);
  assert.match(
    css,
    /\.tour-prompt \{[^}]*bottom: calc\(var\(--rangach-above-nav\) \+ var\(--rangach-cta\) \+ 10px \+ 92px \+ 8px \+ var\(--rangach-vv\) \+ var\(--rangach-tour-lift, 0px\) \+ var\(--rangach-float-lift, 0px\)\)/,
  );
  assert.match(css, /bottom: calc\(20px \+ var\(--rangach-cta\) \+ 92px \+ 8px \+ var\(--rangach-tour-lift, 0px\) \+ var\(--rangach-float-lift, 0px\)\)/);
  const card = renderToStaticMarkup(createElement(TourPromptCard, { lang: "en", withSulwe: false, onYes: noop, onNo: noop }));
  assert.match(card, /data-tour-prompt="card"/);
  assert.match(card, /New here\? Want a quick tour of Rangach\?/);
  assert.match(card, /h-11/);
  assert.doesNotMatch(card, /data-tour-prompt-tail/);
  const luo = renderToStaticMarkup(createElement(TourPromptCard, { lang: "dholuo", withSulwe: true, onYes: noop, onNo: noop }));
  assert.match(luo, new RegExp(uiText("dholuo", "invite_tour_yes")));
  assert.match(luo, new RegExp(uiText("dholuo", "invite_tour_no")));
});

test("invite strings are signed off as drafted and stay clear of funeral and escrow wording", () => {
  const keys = Object.keys(UI_STRINGS).filter((key) => key.startsWith("invite_"));
  assert.deepEqual(keys, ["invite_tour_hi", "invite_tour_card", "invite_tour_yes", "invite_tour_no"]);
  for (const key of keys) {
    const row = UI_STRINGS[key as keyof typeof UI_STRINGS];
    assert.equal(row.draft, false, key);
    assert.match(row.notes, /^Kevin signed off\./, key);
    assert.ok(row.en.trim() && row.dholuo.trim(), key);
    assert.equal(/funeral|escrow/i.test(row.en + row.dholuo), false, key);
  }
  // Kevin approved these exactly as drafted.
  assert.equal(UI_STRINGS.invite_tour_hi.dholuo, "Misawa! Idwaro tour machiek?");
  assert.equal(UI_STRINGS.invite_tour_card.dholuo, "In ng'at manyien? Idwaro tour machiek mar Rangach?");
  assert.equal(UI_STRINGS.invite_tour_yes.dholuo, "Ee, nyisa");
  assert.equal(UI_STRINGS.invite_tour_no.dholuo, "Ok sani");
});

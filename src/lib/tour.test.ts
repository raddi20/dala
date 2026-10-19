import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TourCard } from "@/components/guided-tour";
import { UI_STRINGS, tourStringsMarkdown, uiText } from "@/lib/i18n/strings";
import {
  SELLER_STEPS,
  VISITOR_STEPS,
  advanceTour,
  guidedTourOn,
  persistTourRecord,
  readTourRecord,
  replayTour,
  shouldShowTour,
  skipTour,
  tourBody,
  tourKindForPath,
  tourQueryOn,
  visibleTourBox,
  type TourStore,
} from "@/lib/tour";

const off = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
const on = { NODE_ENV: "test", NEXT_PUBLIC_GUIDED_TOUR: "on" } as NodeJS.ProcessEnv;

function memory(): TourStore & { jar: Map<string, string> } {
  const jar = new Map<string, string>();
  return {
    jar,
    getItem(key) {
      return jar.has(key) ? jar.get(key)! : null;
    },
    setItem(key, value) {
      jar.set(key, value);
    },
  };
}

test("the tour shows once, and Skip and Next are remembered", () => {
  assert.equal(guidedTourOn(off), false);
  assert.equal(guidedTourOn(on), true);
  assert.equal(guidedTourOn({ NODE_ENV: "test", NEXT_PUBLIC_GUIDED_TOUR: "" } as NodeJS.ProcessEnv), false);

  const store = memory();
  const key = "rangach_tour";
  assert.equal(shouldShowTour({ path: "/", flag: true, force: false, seen: false }), true);
  assert.equal(shouldShowTour({ path: "/", flag: false, force: false, seen: false }), false);
  assert.equal(shouldShowTour({ path: "/", flag: true, force: false, seen: true }), false);

  let record = readTourRecord(store, "", key);
  assert.equal(record.seen, false);
  record = advanceTour(record, VISITOR_STEPS.length);
  assert.equal(record.step, 1);
  let cookie = persistTourRecord(store, key, record);
  assert.equal(readTourRecord(null, cookie, key).step, 1);
  assert.equal(readTourRecord(store, "", key).step, 1);

  record = skipTour();
  cookie = persistTourRecord(store, key, record);
  assert.equal(readTourRecord(store, cookie, key).seen, true);
  assert.equal(shouldShowTour({ path: "/", flag: true, force: false, seen: true }), false);

  const fresh = memory();
  let walking = { seen: false, step: 0 };
  for (let i = 0; i < VISITOR_STEPS.length - 1; i += 1) walking = advanceTour(walking, VISITOR_STEPS.length);
  assert.equal(walking.seen, false);
  walking = advanceTour(walking, VISITOR_STEPS.length);
  persistTourRecord(fresh, key, walking);
  assert.equal(readTourRecord(fresh, "", key).seen, true);

  const again = replayTour();
  persistTourRecord(fresh, key, again);
  assert.deepEqual(readTourRecord(fresh, "", key), { seen: false, step: 0 });
  assert.equal(shouldShowTour({ path: "/listings", flag: true, force: false, seen: false }), true);
});

test("the flag hides the tour, and the preview query or a replay can show it", () => {
  assert.equal(tourQueryOn("?tour=1"), true);
  assert.equal(tourQueryOn("tour=1"), true);
  assert.equal(tourQueryOn("?tour=0"), false);
  assert.equal(shouldShowTour({ path: "/", flag: false, force: true, seen: true }), true);
  assert.equal(shouldShowTour({ path: "/admin", flag: true, force: true, seen: false }), false);
  assert.equal(shouldShowTour({ path: "/admin/phones", flag: true, force: false, seen: false }), false);
  assert.equal(tourKindForPath("/listings/new"), "seller");
  assert.equal(tourKindForPath("/account/storefront"), "seller");
  assert.equal(tourKindForPath("/"), "visitor");
  assert.equal(SELLER_STEPS.length >= 2 && SELLER_STEPS.length <= 3, true);
  assert.equal(VISITOR_STEPS.length >= 4 && VISITOR_STEPS.length <= 6, true);
});

test("a missing target has no spotlight", () => {
  assert.equal(visibleTourBox([]), null);
  assert.equal(visibleTourBox([{ top: 0, left: 0, width: 0, height: 40 }]), null);
  const box = visibleTourBox([
    { top: 0, left: 0, width: 0, height: 0 },
    { top: 12, left: 8, width: 120, height: 44 },
  ]);
  assert.equal(box?.width, 120);
});

test("tour copy has a Dholuo draft and stays clear of funeral and escrow wording", () => {
  const keys = Object.keys(UI_STRINGS).filter((key) => key.startsWith("tour_"));
  assert.ok(keys.length >= 10);
  for (const key of keys) {
    const row = UI_STRINGS[key as keyof typeof UI_STRINGS];
    assert.equal(row.draft, true, key);
    assert.ok(row.dholuo.trim(), key);
    assert.equal(/funeral/i.test(row.en + row.dholuo), false, key);
    assert.equal(/escrow/i.test(row.en + row.dholuo), false, key);
  }
  assert.equal(tourBody("en", VISITOR_STEPS[1]), "Home, Explore, Ask, Occasions, and Sell.");
  assert.match(tourBody("dholuo", VISITOR_STEPS[1]), new RegExp(uiText("dholuo", "nav_home")));
  assert.match(tourBody("dholuo", VISITOR_STEPS[1]), new RegExp(uiText("dholuo", "nav_sell")));
  const doc = readFileSync(new URL("../../docs/tour-dholuo-strings.md", import.meta.url), "utf8");
  assert.equal(doc, tourStringsMarkdown());
  const card = renderToStaticMarkup(
    createElement(TourCard, {
      lang: "en",
      title: "Ask Rangach",
      body: "Type a sentence, like fresh tilapia or a fundi in Kisumu.",
      step: 0,
      total: 5,
      last: false,
      onNext: () => undefined,
      onSkip: () => undefined,
    }),
  );
  assert.match(card, /role="dialog"/);
  assert.match(card, /Next/);
  assert.match(card, /Skip/);
  assert.equal((card.match(/data-tour-dot=/g) ?? []).length, 5);
});

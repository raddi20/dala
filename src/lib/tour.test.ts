import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TourCard } from "@/components/guided-tour";
import { UI_STRINGS, tourStringsMarkdown, tourV2StringsMarkdown, uiText } from "@/lib/i18n/strings";
import {
  SELLER_STEPS,
  TAB_STEP_IDS,
  VISITOR_STEPS,
  advanceTour,
  finishHref,
  guidedTourOn,
  neighborStep,
  parseTourRun,
  persistTourRecord,
  placeTourBubble,
  readTourRecord,
  replayTour,
  resumedStepId,
  serializeTourRun,
  shouldShowTour,
  skipTour,
  stepPath,
  stepsForRun,
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
  assert.equal(shouldShowTour({ path: "/listings", flag: false, force: false, seen: false, activeRun: true }), true);
  assert.equal(shouldShowTour({ path: "/admin", flag: false, force: false, seen: false, activeRun: true }), false);
  assert.equal(shouldShowTour({ path: "/admin", flag: true, force: true, seen: false }), false);
  assert.equal(shouldShowTour({ path: "/admin/phones", flag: true, force: false, seen: false }), false);
  assert.equal(tourKindForPath("/listings/new"), "seller");
  assert.equal(tourKindForPath("/account/storefront"), "seller");
  assert.equal(tourKindForPath("/"), "visitor");
  assert.equal(SELLER_STEPS.length, 4);
  assert.equal(VISITOR_STEPS.length >= 4, true);
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

test("tour copy is signed off and stays clear of funeral and escrow wording", () => {
  const keys = Object.keys(UI_STRINGS).filter((key) => key.startsWith("tour_"));
  assert.ok(keys.length >= 10);
  assert.equal(UI_STRINGS.tour_dialog.dholuo, "Tour");
  assert.equal(UI_STRINGS.tour_whatsapp_body.dholuo, "Goch ne wuon ohala e WhatsApp. Penj wach ayie kata fundi Kisumu.");
  assert.equal(UI_STRINGS.tour_skip.dholuo, "Skip");
  assert.equal(UI_STRINGS.tour_done.dholuo, "Done");
  assert.equal(UI_STRINGS.tour_replay.dholuo, "Miya Tour");
  assert.equal(UI_STRINGS.tour_seller_offer_body.dholuo, "Ket nying maber. Kaka Chiemo mar ayie oromo.");
  assert.equal(UI_STRINGS.tour_seller_publish_body.dholuo, "Yaw ka gimoro amora ni maber. Joma ng'iewo gocho ni e WhatsApp.");
  for (const key of keys) {
    const row = UI_STRINGS[key as keyof typeof UI_STRINGS];
    assert.equal(row.draft, false, key);
    assert.ok(row.dholuo.trim(), key);
    assert.equal(/funeral/i.test(row.en + row.dholuo), false, key);
    assert.equal(/escrow/i.test(row.en + row.dholuo), false, key);
  }
  assert.equal(
    tourBody("en", { id: "nav", target: "nav", title: "tour_nav_title", body: "tour_nav_body" }),
    "Home, Explore, Ask, Occasions, and Sell.",
  );
  const navStep = { id: "nav", target: "nav", title: "tour_nav_title" as const, body: "tour_nav_body" as const };
  assert.match(tourBody("dholuo", navStep), new RegExp(uiText("dholuo", "nav_home")));
  assert.match(tourBody("dholuo", navStep), new RegExp(uiText("dholuo", "nav_sell")));
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
      showBack: false,
      onNext: () => undefined,
      onBack: () => undefined,
      onSkip: () => undefined,
    }),
  );
  const keysV2 = Object.keys(UI_STRINGS).filter((key) => key.startsWith("tour2_"));
  assert.ok(keysV2.length >= 5);
  for (const key of keysV2) {
    const row = UI_STRINGS[key as keyof typeof UI_STRINGS];
    assert.equal(row.draft, false, key);
    assert.ok(row.dholuo.trim(), key);
    assert.equal(/funeral/i.test(row.en + row.dholuo), false, key);
    assert.equal(/escrow/i.test(row.en + row.dholuo), false, key);
  }
  assert.equal(UI_STRINGS.tour2_occasions_body.dholuo, "nyasi keto gik ma jogi dwaro, kaka ayie.");
  assert.equal(UI_STRINGS.tour2_price_body.dholuo, "Ket nengo, kata weye nono twak e WhatsApp.");
  const v2 = readFileSync(new URL("../../docs/tour-dholuo-strings-v2.md", import.meta.url), "utf8");
  assert.equal(v2, tourV2StringsMarkdown());
  assert.match(card, /role="dialog"/);
  assert.match(card, /Next/);
  assert.match(card, /Skip/);
  assert.equal((card.match(/data-tour-dot=/g) ?? []).length, 5);
});

test("the bubble flips above a low target and stays on a 360px screen", () => {
  const viewport = { width: 360, height: 740 };
  const below = placeTourBubble({
    target: { top: 80, left: 16, width: 200, height: 44 },
    viewport,
    bubbleHeight: 180,
  });
  assert.equal(below.side, "below");
  assert.ok(below.spot);
  assert.ok(below.arrow);
  assert.ok(below.bubble.left >= 8);
  assert.ok(below.bubble.left + below.bubble.width <= viewport.width - 8);

  const above = placeTourBubble({
    target: { top: 640, left: 8, width: 70, height: 64 },
    viewport,
    bubbleHeight: 180,
  });
  assert.equal(above.side, "above");
  assert.ok(above.bubble.top >= 8);
  assert.ok(above.bubble.top + above.bubble.height <= viewport.height - 8);
  assert.ok(above.arrow && above.arrow.y1 < above.arrow.y2);

  const missing = placeTourBubble({ target: null, viewport, bubbleHeight: 180 });
  assert.equal(missing.side, "center");
  assert.equal(missing.spot, null);
  assert.equal(missing.arrow, null);
  assert.equal(visibleTourBox([{ top: 0, left: 0, width: 0, height: 20 }]), null);
});

test("the tour resumes a step after navigation and returns to the start path", () => {
  const run = { kind: "visitor" as const, stepId: "filters", startPath: "/shops" };
  const raw = serializeTourRun(run);
  assert.deepEqual(parseTourRun(raw), run);
  assert.equal(resumedStepId(raw, "visitor", VISITOR_STEPS), "filters");
  assert.equal(resumedStepId(raw, "seller", SELLER_STEPS), SELLER_STEPS[0].id);
  assert.equal(neighborStep(VISITOR_STEPS, "filters", 1).id, "town");
  assert.equal(stepPath(VISITOR_STEPS.find((step) => step.id === "town")!, null), "/listings");
  assert.equal(stepPath(VISITOR_STEPS.find((step) => step.id === "whatsapp")!, "/listings/abc"), "/listings/abc");
  assert.equal(stepPath(VISITOR_STEPS.find((step) => step.id === "whatsapp")!, null), null);
  assert.equal(stepsForRun("visitor", null).some((step) => step.id === "whatsapp"), false);
  assert.equal(stepsForRun("visitor", "/listings/abc").some((step) => step.id === "whatsapp"), true);
  assert.equal(finishHref("/shops", "/listings/abc"), "/shops");
  assert.equal(finishHref("/shops", "/shops"), null);
  assert.equal(neighborStep(VISITOR_STEPS, "sell", 1).done, true);

  const tabs = VISITOR_STEPS.filter((step) => (TAB_STEP_IDS as readonly string[]).includes(step.id)).map((step) => step.id);
  assert.deepEqual(tabs, ["home", "explore", "ask-tab", "occasions", "sell"]);
  assert.equal(VISITOR_STEPS.some((step) => step.target === "nav"), false);
  assert.deepEqual(
    SELLER_STEPS.map((step) => step.target),
    ["sell-title", "sell-photo", "sell-price", "sell-publish"],
  );
});

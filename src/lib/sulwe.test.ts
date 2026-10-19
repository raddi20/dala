import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { UI_STRINGS, sulweStringsMarkdown, uiText } from "@/lib/i18n/strings";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SulweArt, SulweSparkArt, SulweWandArt } from "@/components/sulwe-art";
import {
  SULWE_MIN_SIZE,
  SULWE_REACTIONS,
  SULWE_SIZE,
  SULWE_VOILA_MS,
  SULWE_WAND_LENGTH,
  SULWE_WAND_MS,
  sulweDockBottom,
  sulweWand,
  classifySulwePointer,
  keyboardCoversScreen,
  nextSulweReaction,
  placeSulwe,
  readSulweMinimised,
  shouldShowSulwe,
  sulweAsk,
  sulweGuideArrow,
  sulweHiddenPath,
  sulweOn,
  sulweQueryOn,
  writeSulweMinimised,
  type SulweReaction,
} from "@/lib/sulwe";
import { SULWE_TOUR_SIZE } from "@/lib/sulwe";
import { placeTourBubble } from "@/lib/tour";

const off = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
const on = { NODE_ENV: "test", NEXT_PUBLIC_SULWE: "on" } as NodeJS.ProcessEnv;

test("the flag is off by default and the preview query can show him", () => {
  assert.equal(sulweOn(off), false);
  assert.equal(sulweOn(on), true);
  assert.equal(sulweOn({ NODE_ENV: "test", NEXT_PUBLIC_SULWE: "" } as NodeJS.ProcessEnv), false);
  assert.equal(sulweQueryOn("sulwe=1"), true);
  assert.equal(sulweQueryOn("tour=1"), false);
  assert.equal(shouldShowSulwe({ path: "/", flag: false, force: false, keyboard: false }), false);
  assert.equal(shouldShowSulwe({ path: "/listings", flag: false, force: true, keyboard: false }), true);
  assert.equal(shouldShowSulwe({ path: "/", flag: true, force: false, keyboard: true }), false);
  assert.equal(keyboardCoversScreen({ innerHeight: 740, visualHeight: 400 }), true);
  assert.equal(keyboardCoversScreen({ innerHeight: 740, visualHeight: 700 }), false);
});

test("Sulwe stays off admin, auth, and payment pages", () => {
  for (const path of ["/admin", "/admin/orders", "/login", "/register", "/forgot-password", "/reset-password", "/orders/abc", "/account/orders", "/upgrade", "/upgrade/return", "/send-home", "/pricing"]) {
    assert.equal(sulweHiddenPath(path), true, path);
    assert.equal(shouldShowSulwe({ path, flag: true, force: true, keyboard: false }), false, path);
  }
  assert.equal(sulweHiddenPath("/"), false);
  assert.equal(sulweHiddenPath("/listings"), false);
  assert.equal(sulweHiddenPath("/account"), false);
});

test("minimise is remembered on the device", () => {
  const jar = new Map<string, string>();
  const store = {
    getItem: (key: string) => (jar.has(key) ? jar.get(key)! : null),
    setItem: (key: string, value: string) => jar.set(key, value),
  };
  assert.equal(readSulweMinimised(store), false);
  writeSulweMinimised(store, true);
  assert.equal(readSulweMinimised(store), true);
  writeSulweMinimised(store, false);
  assert.equal(readSulweMinimised(store), false);
  assert.equal(readSulweMinimised(null), false);
});

test("tap reactions cycle without a repeat until every one has played", () => {
  let bag: readonly SulweReaction[] = [];
  const seen: SulweReaction[] = [];
  for (let i = 0; i < SULWE_REACTIONS.length; i += 1) {
    const next = nextSulweReaction(bag, () => 0);
    assert.equal(seen.includes(next.reaction), false);
    seen.push(next.reaction);
    bag = next.bag;
  }
  assert.equal(new Set(seen).size, SULWE_REACTIONS.length);
  const again = nextSulweReaction(bag, () => 0.99);
  assert.equal(SULWE_REACTIONS.includes(again.reaction), true);
  assert.equal(again.bag.length, SULWE_REACTIONS.length - 1);
});

test("a second tap or a long press opens chat, and a single tap reacts", () => {
  assert.deepEqual(classifySulwePointer({ kind: "up", heldMs: 80, sinceLastTapMs: null }), { openChat: false, react: true });
  assert.deepEqual(classifySulwePointer({ kind: "up", heldMs: 90, sinceLastTapMs: 250 }), { openChat: true, react: true });
  assert.deepEqual(classifySulwePointer({ kind: "up", heldMs: 90, sinceLastTapMs: 900 }), { openChat: false, react: true });
  assert.deepEqual(classifySulwePointer({ kind: "long", heldMs: 500, sinceLastTapMs: null }), { openChat: true, react: false });
  assert.deepEqual(classifySulwePointer({ kind: "up", heldMs: 500, sinceLastTapMs: null }), { openChat: true, react: false });
});

test("chat calls the existing search and keeps three cards", async () => {
  let city = "";
  const result = await sulweAsk("fundi in Kisumu", {
    interpret: async (input) => {
      assert.equal(input, "fundi in Kisumu");
      return {
        city: "Kisumu",
        region: "homeland",
        category: "Construction & trades",
        type: "services",
        verified: false,
        occasion: "",
        hints: ["fundi"],
        summary: "Kisumu · Construction & trades",
      };
    },
    search: async (filters) => {
      city = filters.city ?? "";
      assert.equal(filters.pageSize, 3);
      assert.equal(filters.category, "Construction & trades");
      return {
        hits: [
          { kind: "listing", listing: { id: "a", title: "Fundi in Kisumu", city: "Kisumu" } },
          { kind: "listing", listing: { id: "b", title: "Roof repair", city: "Kisumu" } },
          { kind: "shop", shop: { slug: "lake", name: "Lake fundi", city: "Kisumu" } },
          { kind: "offering", offering: { title: "Extra", shopSlug: "lake", city: "Kisumu" } },
        ],
      };
    },
  });
  assert.equal(city, "Kisumu");
  assert.equal(result.cards.length, 3);
  assert.equal(result.cards[0]?.title, "Fundi in Kisumu");
  assert.equal(result.cards[0]?.href, "/listings/a");
  assert.equal(result.cards[2]?.href, "/b/lake");
  assert.match(result.href, /\/listings\?/);
  assert.match(result.href, /city=Kisumu/);
  assert.match(result.href, /nl=/);
  assert.equal(/funeral|escrow/i.test(`${result.summary} ${result.query}`), false);

  let called = false;
  const empty = await sulweAsk("   ", {
    interpret: async () => {
      called = true;
      throw new Error("no");
    },
    search: async () => {
      called = true;
      return { hits: [] };
    },
  });
  assert.equal(called, false);
  assert.equal(empty.href, "/listings");
});

test("Sulwe stays beside the bubble on a 360px screen", () => {
  const at = placeSulwe({
    bubble: { top: 420, left: 16, width: 328, height: 200 },
    target: { top: 80, left: 24, width: 300, height: 48 },
    viewport: { width: 360, height: 740 },
  });
  assert.ok(at);
  assert.ok(at.left >= 8);
  assert.ok(at.left + 72 <= 352);
  assert.ok(at.top >= 8);
  assert.ok(at.top + 72 <= 732);
  const arrow = sulweGuideArrow(at, { top: 80, left: 24, width: 300, height: 48 });
  assert.ok(arrow.y1 > arrow.y2);

  const tight = placeSulwe({
    bubble: { top: 220, left: 16, width: 328, height: 180 },
    target: { top: 120, left: 16, width: 328, height: 86 },
    viewport: { width: 360, height: 740 },
  });
  assert.ok(tight);
  assert.ok(tight.top >= 406, String(tight.top));
  assert.ok(tight.left >= 8 && tight.left + 72 <= 352);
});

function overlaps(a: { top: number; left: number; width: number; height: number }, b: typeof a) {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

test("the guide Sulwe never covers the bubble or the spotlight on any tour step", () => {
  const viewports = [
    { width: 360, height: 740 },
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ];
  for (const viewport of viewports) {
    const mobile = viewport.width < 768;
    const tab = (index: number) => ({ top: viewport.height - 64, left: (viewport.width / 5) * index, width: viewport.width / 5, height: 64 });
    const targets = [
      // Ask Rangach box on Home (the first step), then the bottom tabs, Filters, Town, WhatsApp, Sell.
      { top: 166, left: 16, width: viewport.width - 120, height: 44 },
      ...(mobile ? [0, 1, 2, 3, 4].map(tab) : [{ top: 12, left: viewport.width - 420, width: 80, height: 40 }]),
      { top: 132, left: 16, width: 96, height: 40 },
      { top: 300, left: 16, width: Math.min(viewport.width - 32, 600), height: 44 },
      { top: viewport.height - (mobile ? 130 : 70), left: 16, width: Math.min(viewport.width - 32, 400), height: 48 },
      { top: viewport.height / 2 - 20, left: viewport.width / 2 - 60, width: 120, height: 40 },
    ];
    for (const target of targets) {
      for (const bubbleHeight of [160, 200, 240]) {
        const placed = placeTourBubble({ target, viewport, bubbleHeight });
        const at = placeSulwe({ bubble: placed.bubble, target: placed.spot, viewport });
        const label = `${viewport.width} ${JSON.stringify(target)} ${bubbleHeight}`;
        assert.ok(at, label);
        const box = { top: at.top, left: at.left, width: SULWE_TOUR_SIZE, height: SULWE_TOUR_SIZE };
        assert.equal(overlaps(box, placed.bubble), false, `bubble ${label}`);
        assert.ok(placed.spot);
        assert.equal(overlaps(box, placed.spot), false, `spot ${label}`);
        assert.ok(box.left >= 0 && box.left + box.width <= viewport.width, label);
        assert.ok(box.top >= 0 && box.top + box.height <= viewport.height, label);
      }
    }
  }
  // No target: he still stays off the centred bubble.
  const centred = placeTourBubble({ target: null, viewport: { width: 360, height: 740 }, bubbleHeight: 220 });
  const solo = placeSulwe({ bubble: centred.bubble, target: null, viewport: { width: 360, height: 740 } });
  assert.ok(solo);
  assert.equal(overlaps({ ...solo, width: SULWE_TOUR_SIZE, height: SULWE_TOUR_SIZE }, centred.bubble), false);
  // A screen with no room at all returns null rather than covering the text.
  assert.equal(
    placeSulwe({ bubble: { top: 0, left: 0, width: 80, height: 80 }, target: null, viewport: { width: 80, height: 80 } }),
    null,
  );
});

test("Sulwe strings have signed-off Dholuo and stay clear of funeral and escrow wording", () => {
  const keys = Object.keys(UI_STRINGS).filter((key) => key.startsWith("sulwe_"));
  assert.ok(keys.includes("sulwe_hi"));
  assert.ok(keys.includes("sulwe_chip_fundi"));
  assert.equal(uiText("en", "sulwe_hi"), "Hi, I'm Sulwe, what are you looking for?");
  assert.equal(uiText("en", "understood"), "Rangach understood");
  for (const key of keys) {
    const row = UI_STRINGS[key as keyof typeof UI_STRINGS];
    assert.equal(row.draft, false, key);
    assert.ok(row.dholuo.trim(), key);
    assert.equal(/funeral/i.test(row.en + row.dholuo), false, key);
    assert.equal(/escrow/i.test(row.en + row.dholuo), false, key);
  }
  assert.equal(uiText("dholuo", "sulwe_talk"), "Wuo gi Sulwe");
  assert.equal(uiText("dholuo", "sulwe_minimise"), "Shrink Sulwe");
  assert.equal(uiText("dholuo", "sulwe_hi"), "Misawa, an Sulwe, ere kaka anyalo konyi?");
  assert.equal(uiText("dholuo", "sulwe_found"), "Magi ema ayudo ne {query}.");
  assert.equal(uiText("dholuo", "sulwe_see_all"), "Duoko duto");
  assert.equal(uiText("dholuo", "sulwe_chat"), "Chat gi Sulwe");
  const doc = readFileSync(new URL("../../docs/sulwe-dholuo-strings.md", import.meta.url), "utf8");
  assert.equal(doc, sulweStringsMarkdown());
});

test("docked Sulwe is about 1.6 times his old 56px and the minimised star grew too", () => {
  assert.ok(SULWE_SIZE >= 56 * 1.5 && SULWE_SIZE <= 56 * 1.8, String(SULWE_SIZE));
  assert.ok(SULWE_MIN_SIZE > 32 && SULWE_MIN_SIZE >= 44);
});

test("Sulwe docks above the bottom nav and above a sticky WhatsApp bar", () => {
  // 390x844 phone: nav top 779.
  const navOnly = sulweDockBottom({ viewportHeight: 844, obstacleTops: [779] });
  assert.equal(navOnly, 844 - 779 + 10);
  assert.ok(844 - navOnly - SULWE_SIZE >= 0);
  // Listing page: the WhatsApp bar sits above the nav, so he moves above it.
  const withBar = sulweDockBottom({ viewportHeight: 844, obstacleTops: [779, 711] });
  assert.equal(withBar, 844 - 711 + 10);
  // Desktop: no nav, no bar.
  assert.equal(sulweDockBottom({ viewportHeight: 800, obstacleTops: [] }), 20);
  // A bar near the top of the page is not a bottom bar.
  assert.equal(sulweDockBottom({ viewportHeight: 800, obstacleTops: [60] }), 20);
  assert.equal(sulweDockBottom({ viewportHeight: 0, obstacleTops: [779] }), 20);
});

test("the wand aims at the target and the sparkles end on it", () => {
  const sulwe = { top: 600, left: 20 };
  const target = { top: 780, left: 0, width: 78, height: 64 };
  const wand = sulweWand(sulwe, target, 72);
  assert.equal(wand.target.x, 39);
  assert.equal(wand.target.y, 812);
  // Target is below him, so the wand points down (between 0 and 180 degrees).
  assert.ok(wand.angle > 0 && wand.angle < 180, String(wand.angle));
  assert.ok(Math.abs(Math.hypot(wand.tip.x - wand.hand.x, wand.tip.y - wand.hand.y) - SULWE_WAND_LENGTH) < 0.01);
  const last = wand.trail[wand.trail.length - 1];
  assert.ok(Math.abs(wand.tip.x + last.x - wand.target.x) <= 1);
  assert.ok(Math.abs(wand.tip.y + last.y - wand.target.y) <= 1);
  assert.ok(wand.trail.length >= 6 && wand.burst.length >= 6);
  for (let i = 1; i < wand.trail.length; i += 1) assert.ok(wand.trail[i].delay >= wand.trail[i - 1].delay);
  const up = sulweWand({ top: 300, left: 150 }, { top: 40, left: 20, width: 300, height: 48 }, 72);
  assert.ok(up.angle < 0, String(up.angle));
  // Quick and playful: the whole step lands in 0.6 to 1.0 s, and the bubble appears after the sparkles start.
  assert.ok(SULWE_WAND_MS >= 600 && SULWE_WAND_MS <= 1000);
  assert.ok(SULWE_VOILA_MS > 0 && SULWE_VOILA_MS < SULWE_WAND_MS);
  for (const spark of [...wand.trail, ...wand.burst]) assert.ok(spark.delay + 500 <= 1000, String(spark.delay));
});

test("the wand, sparkle, and twinkle art render", () => {
  assert.match(renderToStaticMarkup(createElement(SulweWandArt)), /<polygon/);
  assert.match(renderToStaticMarkup(createElement(SulweSparkArt)), /<path/);
  assert.match(renderToStaticMarkup(createElement(SulweArt, { twinkle: true })), /sulwe-twinkle/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(SulweArt)), /sulwe-twinkle/);
});

test("new Sulwe motion animates only transform and opacity and stops under reduced motion", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const names = ["sulwe-halo", "sulwe-bob", "sulwe-twinkle", "sulwe-star-twinkle", "sulwe-wand-swing", "sulwe-spark-trail", "sulwe-spark-burst", "tour-voila", "tour-dim-out"];
  for (const name of names) {
    const start = css.indexOf(`@keyframes ${name} {`);
    assert.ok(start >= 0, name);
    const body = css.slice(start, css.indexOf("\n}\n", start));
    const props = [...body.matchAll(/^\s+([a-z-]+):/gm)].map((match) => match[1]);
    assert.ok(props.length > 0, name);
    for (const prop of props) assert.ok(prop === "transform" || prop === "opacity", `${name} ${prop}`);
  }
  const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
  for (const selector of [".sulwe-halo", ".sulwe-bob", ".sulwe-min-star", ".sulwe-wand", ".sulwe-spark-trail", ".tour-dim-out"]) {
    assert.ok(reduced.includes(selector), selector);
  }
  assert.match(css, /\.sulwe-art \*,[\s\S]*?animation: none !important/);
  assert.match(css, /\.sulwe-badge \{[\s\S]*?box-shadow/);
});

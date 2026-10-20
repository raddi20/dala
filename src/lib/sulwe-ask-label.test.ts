import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { UI_STRINGS, uiText } from "@/lib/i18n/strings";
import {
  SULWE_ASK_MAX_OPENS,
  SULWE_DOCK_GAP,
  SULWE_OPENS_KEY,
  SULWE_SIZE,
  bumpSulweOpens,
  placeAskLabel,
  readSulweOpens,
  shouldShowAskLabel,
  sulweDockBottom,
} from "@/lib/sulwe";

const base = { show: true, minimised: false, touring: false, invite: false, chat: false, keyboard: false, opens: 0 };

test("Ask Sulwe pill shows for new visitors and hides in every blocked state", () => {
  assert.equal(shouldShowAskLabel(base), true);
  for (const key of ["minimised", "touring", "invite", "chat", "keyboard"] as const) {
    assert.equal(shouldShowAskLabel({ ...base, [key]: true }), false, key);
  }
  assert.equal(shouldShowAskLabel({ ...base, show: false }), false);
  assert.equal(shouldShowAskLabel({ ...base, opens: 2 }), true);
  assert.equal(shouldShowAskLabel({ ...base, opens: 3 }), false);
  assert.equal(shouldShowAskLabel({ ...base, opens: 9 }), false);
});

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value), data };
}

test("open counter counts in localStorage and stops the pill after three opens", () => {
  const store = memoryStore();
  assert.equal(readSulweOpens(store), 0);
  assert.equal(readSulweOpens(null), 0);
  assert.equal(SULWE_ASK_MAX_OPENS, 3);
  for (let i = 1; i <= 3; i += 1) {
    assert.equal(shouldShowAskLabel({ ...base, opens: readSulweOpens(store) }), true, `before open ${i}`);
    assert.equal(bumpSulweOpens(store), i);
  }
  assert.equal(store.data.get(SULWE_OPENS_KEY), "3");
  assert.equal(shouldShowAskLabel({ ...base, opens: readSulweOpens(store) }), false);
  assert.equal(readSulweOpens(memoryStore({ [SULWE_OPENS_KEY]: "junk" })), 0);
  const broken = { getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } };
  assert.equal(readSulweOpens(broken), 0);
  assert.equal(bumpSulweOpens(broken), 1);
});

type Box = { top: number; left: number; width: number; height: number };
function overlaps(a: Box, b: Box) {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}

/** Sulwe docked the way the component docks him: right 12, above the highest bottom bar. */
function scene(width: number, height: number, bars: Box[]) {
  const bottom = sulweDockBottom({ viewportHeight: height, obstacleTops: bars.map((bar) => bar.top) });
  const sulwe = { top: height - bottom - SULWE_SIZE, left: width - 12 - SULWE_SIZE, width: SULWE_SIZE, height: SULWE_SIZE };
  return { sulwe, viewport: { width, height } };
}

test("pill never overlaps Sulwe, the nav, the sticky WhatsApp bar, the header, or the screen edge", () => {
  const cases: { name: string; width: number; height: number; bars: Box[] }[] = [
    { name: "home 360x740", width: 360, height: 740, bars: [{ top: 676, left: 0, width: 360, height: 64 }] },
    { name: "home 390x844", width: 390, height: 844, bars: [{ top: 780, left: 0, width: 390, height: 64 }] },
    {
      name: "listing 390 with WhatsApp bar",
      width: 390,
      height: 844,
      bars: [
        { top: 780, left: 0, width: 390, height: 64 },
        { top: 708, left: 0, width: 390, height: 72 },
      ],
    },
    { name: "desktop 1280", width: 1280, height: 800, bars: [] },
  ];
  const header = (width: number) => ({ top: 0, left: 0, width, height: 56 });
  for (const label of [{ width: 152, height: 36 }, { width: 196, height: 36 }]) {
    for (const item of cases) {
      const { sulwe, viewport } = scene(item.width, item.height, item.bars);
      const obstacles = [...item.bars, header(item.width)];
      const pos = placeAskLabel({ sulwe, label, viewport, obstacles });
      assert.ok(pos, item.name);
      const box = { ...pos, ...label };
      assert.equal(pos.side, "left", item.name);
      assert.equal(overlaps(box, sulwe), false, item.name);
      for (const bar of obstacles) assert.equal(overlaps(box, bar), false, item.name);
      assert.ok(box.left >= 8 && box.left + box.width <= item.width - 8, item.name);
      assert.ok(box.top + box.height <= sulwe.top + sulwe.height, item.name);
      assert.ok(sulwe.left - (box.left + box.width) <= SULWE_DOCK_GAP, `${item.name}: sits right beside Sulwe`);
    }
  }
});

test("pill goes above Sulwe when the side is blocked, and hides when nothing is free", () => {
  const { sulwe, viewport } = scene(390, 844, [{ top: 780, left: 0, width: 390, height: 64 }]);
  const blocker = { top: sulwe.top + 4, left: 0, width: sulwe.left - 2, height: sulwe.height };
  const pos = placeAskLabel({ sulwe, label: { width: 152, height: 36 }, viewport, obstacles: [blocker] });
  assert.equal(pos?.side, "above");
  assert.ok(pos && pos.top + 36 <= sulwe.top);
  const none = placeAskLabel({ sulwe, label: { width: 152, height: 36 }, viewport, obstacles: [{ top: 0, left: 0, width: 390, height: 844 }] });
  assert.equal(none, null);
  assert.equal(placeAskLabel({ sulwe, label: { width: 0, height: 0 }, viewport, obstacles: [] }), null);
});

test("sulwe_ask_label exists and is signed off", () => {
  const row = UI_STRINGS.sulwe_ask_label;
  assert.equal(row.en, "Ask Sulwe anything");
  assert.equal(row.dholuo, "Penj Sulwe gimoro amora");
  assert.equal(row.draft, false);
  assert.match(row.notes, /^Kevin signed off/);
  assert.equal(uiText("dholuo", "sulwe_ask_label"), "Penj Sulwe gimoro amora");
  assert.equal(/funeral|escrow/i.test(row.en + row.dholuo), false);
});

test("tapping the pill opens the chat through the counted path, as an accessible button", () => {
  const source = readFileSync("src/components/sulwe.tsx", "utf8");
  const pill = source.slice(source.indexOf("data-sulwe-ask=\"\"") - 900, source.indexOf("data-sulwe-ask=\"\"") + 200);
  assert.match(pill, /<button\s+ref=\{askRef\}\s+type="button"/);
  assert.match(pill, /aria-label=\{uiText\(lang, "sulwe_ask_label"\)\}/);
  assert.match(pill, /onClick=\{openChat\}/);
  const open = source.slice(source.indexOf("const openChat"), source.indexOf("const openChat") + 400);
  assert.match(open, /bumpSulweOpens\(window\.localStorage\)/);
  assert.match(open, /setChat\(true\)/);
  // Every way into the chat goes through openChat, so the count is right.
  assert.equal((source.match(/setChat\(true\)/g) ?? []).length, 1);
  assert.match(source, /shouldShowAskLabel\(\{ show, minimised, touring, invite, chat, keyboard, opens \}\)/);
  assert.match(source, /data-tour-prompt/);
  // No motion class under reduced motion, and the CSS only animates with no-preference.
  assert.match(source, /askPos && !reduced \? " sulwe-ask-pop" : ""/);
  const css = readFileSync("src/app/globals.css", "utf8");
  const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: no-preference)", css.indexOf(".sulwe-ask-pop")), css.indexOf(".sulwe-ask-pop"));
  assert.match(block, /no-preference/);
});

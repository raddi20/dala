import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { UI_STRINGS, sulweStringsMarkdown, uiText } from "@/lib/i18n/strings";
import {
  SULWE_REACTIONS,
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
  assert.ok(tight.top >= 206);
  assert.ok(tight.left >= 8 && tight.left + 72 <= 352);
});

test("new Sulwe strings have Dholuo drafts and stay clear of funeral and escrow wording", () => {
  const keys = Object.keys(UI_STRINGS).filter((key) => key.startsWith("sulwe_"));
  assert.ok(keys.includes("sulwe_hi"));
  assert.ok(keys.includes("sulwe_chip_fundi"));
  assert.equal(uiText("en", "sulwe_hi"), "Hi, I'm Sulwe, what are you looking for?");
  assert.equal(uiText("en", "understood"), "Rangach understood");
  for (const key of keys) {
    const row = UI_STRINGS[key as keyof typeof UI_STRINGS];
    assert.equal(row.draft, true, key);
    assert.ok(row.dholuo.trim(), key);
    assert.equal(/funeral/i.test(row.en + row.dholuo), false, key);
    assert.equal(/escrow/i.test(row.en + row.dholuo), false, key);
  }
  const doc = readFileSync(new URL("../../docs/sulwe-dholuo-strings.md", import.meta.url), "utf8");
  assert.equal(doc, sulweStringsMarkdown());
});

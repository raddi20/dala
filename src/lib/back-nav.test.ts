import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  backBarTitle,
  backFallback,
  cameFromApp,
  pageTitleFromDocument,
  showsBackBar,
} from "@/lib/back-nav";

const origin = "https://www.rangach.co.ke";

test("back falls through to the parent for a cold visit", () => {
  assert.equal(backFallback({ pathname: "/b/mama-atieno" }), "/shops");
  assert.equal(backFallback({ pathname: "/b/mama-atieno/" }), "/shops");
  assert.equal(
    backFallback({ pathname: "/b/mama-atieno", hash: "#offering-tray" }),
    "/b/mama-atieno",
  );
  assert.equal(backFallback({ pathname: "/b/mama-atieno/sticker" }), "/b/mama-atieno");
  assert.equal(backFallback({ pathname: "/listings/abc" }), "/listings");
  assert.equal(backFallback({ pathname: "/listings/abc/edit" }), "/listings/abc");
  assert.equal(backFallback({ pathname: "/listings/new" }), "/listings");
  assert.equal(backFallback({ pathname: "/listings", search: "category=Catering" }), "/categories");
  assert.equal(backFallback({ pathname: "/listings", search: "?category=Food+%26+restaurants" }), "/categories");
  assert.equal(backFallback({ pathname: "/listings" }), "/");
  assert.equal(backFallback({ pathname: "/listings", search: "q=catering" }), "/");
  assert.equal(backFallback({ pathname: "/categories" }), "/");
  assert.equal(backFallback({ pathname: "/occasions/weddings" }), "/occasions");
  assert.equal(backFallback({ pathname: "/occasions" }), "/");
  assert.equal(backFallback({ pathname: "/account" }), "/");
  assert.equal(backFallback({ pathname: "/account/storefront" }), "/account");
  assert.equal(backFallback({ pathname: "/account/insights" }), "/account");
  assert.equal(backFallback({ pathname: "/account/storefront/offerings/tray" }), "/account");
  assert.equal(backFallback({ pathname: "/admin/phones" }), "/admin");
  assert.equal(backFallback({ pathname: "/admin" }), "/");
  assert.equal(backFallback({ pathname: "/people/user_1" }), "/");
  assert.equal(backFallback({ pathname: "/shops" }), "/");
  assert.equal(backFallback({ pathname: "/safety" }), "/");
  assert.equal(backFallback({ pathname: "/login" }), "/");
  assert.equal(showsBackBar("/"), false);
  assert.equal(showsBackBar("/b/mama-atieno"), true);
});

test("the bar title is the page, and the document title drops the brand suffix", () => {
  assert.equal(backBarTitle({ pathname: "/b/mama-atieno" }), "Shop");
  assert.equal(backBarTitle({ pathname: "/b/mama-atieno", hash: "#offering-1" }), "Offering");
  assert.equal(backBarTitle({ pathname: "/b/mama-atieno/sticker" }), "Print sticker");
  assert.equal(backBarTitle({ pathname: "/listings", search: "category=Catering" }), "Catering");
  assert.equal(backBarTitle({ pathname: "/admin/phones" }), "Phone numbers");
  assert.equal(backBarTitle({ pathname: "/admin/ai" }), "Admin");
  assert.equal(pageTitleFromDocument("Atieno Odhiambo · Rangach", "Rangach"), "Atieno Odhiambo");
  assert.equal(pageTitleFromDocument("Rangach", "Rangach"), "");
  assert.equal(pageTitleFromDocument("Home catering tray · Rangach", "Rangach"), "Home catering tray");
});

test("in-app history wins, and an outside referrer does not", () => {
  assert.equal(
    cameFromApp({ navCount: 1, referrer: "", historyLength: 1, origin }),
    true,
  );
  assert.equal(
    cameFromApp({
      navCount: 0,
      referrer: "https://www.rangach.co.ke/listings?q=catering",
      historyLength: 2,
      origin,
    }),
    true,
  );
  assert.equal(
    cameFromApp({
      navCount: 0,
      referrer: "https://www.rangach.co.ke/shops",
      historyLength: 1,
      origin,
    }),
    false,
  );
  assert.equal(
    cameFromApp({
      navCount: 0,
      referrer: "https://www.google.com/search?q=rangach",
      historyLength: 3,
      origin,
    }),
    false,
  );
  assert.equal(
    cameFromApp({ navCount: 0, referrer: "", historyLength: 2, origin }),
    false,
  );
  assert.equal(
    cameFromApp({ navCount: 0, referrer: "not a url", historyLength: 4, origin }),
    false,
  );
});

test("the back bar is shared, labelled, and kept off paper", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const bar = readFileSync(new URL("../components/back-bar.tsx", import.meta.url), "utf8");
  const sticker = readFileSync(new URL("../app/b/[slug]/sticker/sticker.css", import.meta.url), "utf8");
  assert.match(layout, /BackBar/);
  assert.match(bar, /aria-label="Go back"/);
  assert.match(bar, /router\.back\(\)/);
  assert.match(bar, /showsBackBar/);
  assert.match(bar, /print:hidden/);
  assert.match(bar, /min-h-11/);
  assert.match(sticker, /\.back-bar/);
});

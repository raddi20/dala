import assert from "node:assert/strict";
import test from "node:test";
import { ASK_HREF, activeBottomTab } from "@/lib/bottom-nav";

test("the bottom nav marks the tab that matches the page", () => {
  assert.equal(activeBottomTab("/"), "home");
  assert.equal(activeBottomTab("/listings"), "explore");
  assert.equal(activeBottomTab("/listings", "q=tilapia"), "explore");
  assert.equal(activeBottomTab("/listings", "nl="), "ask");
  assert.equal(activeBottomTab("/listings", "nl=catering+for+an+ayie"), "ask");
  assert.equal(activeBottomTab("/shops"), "explore");
  assert.equal(activeBottomTab("/b/usenge-fish"), "explore");
  assert.equal(activeBottomTab("/categories"), "explore");
  assert.equal(activeBottomTab("/listings/abc"), "explore");
  assert.equal(activeBottomTab("/occasions"), "occasions");
  assert.equal(activeBottomTab("/occasions/weddings-dowry"), "occasions");
  assert.equal(activeBottomTab("/listings/new"), "sell");
  assert.equal(activeBottomTab("/list"), "sell");
  assert.equal(activeBottomTab("/account/storefront"), "sell");
  assert.equal(activeBottomTab("/account"), null);
  assert.equal(activeBottomTab("/login"), null);
  assert.equal(ASK_HREF.startsWith("/listings?nl"), true);
});

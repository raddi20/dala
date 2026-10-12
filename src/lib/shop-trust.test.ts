import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { shopPlaceLine, shopTrustLine } from "@/lib/shop-trust";

test("the trust line names only the checks that were granted", () => {
  assert.equal(shopTrustLine({}), "");
  assert.equal(shopTrustLine({ verified: true }), "Checked by Rangach");
  assert.equal(shopTrustLine({ phoneVerified: true }), "Checked by Rangach: phone");
  assert.equal(
    shopTrustLine({ phoneVerified: true, locationVerified: true, businessVerified: true }),
    "Checked by Rangach: phone, location, business visit",
  );
  assert.equal(shopPlaceLine("Food & restaurants", "Nairobi"), "Food & restaurants · Kenya");
  assert.doesNotMatch(shopTrustLine({ phoneVerified: true, locationVerified: true, businessVerified: true }), /funeral/i);
});

test("the shop page keeps the safety rules and one WhatsApp bar", () => {
  const source = readFileSync(new URL("../app/b/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(source, /publicSellerContacts/);
  assert.match(source, /DemoContactNote/);
  assert.match(source, /sticky-cta-bar/);
  assert.match(source, /WhatsApp \{shop\.user\.name\}/);
  assert.match(source, /variant="link"/);
  assert.equal(source.includes("SellerContactChannels"), false);
  assert.equal(source.includes("Phone {"), false);
  assert.equal(source.includes("In short"), false);
  assert.doesNotMatch(source, /funeral/i);
  assert.equal(source.includes("email={"), false);
  assert.equal(source.includes("mailto:"), false);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SellerContactChannels } from "@/components/seller-contact";
import { listingOgModel, shopOgModel } from "@/lib/og-model";
import { toPublicListing } from "@/lib/search";
import { publicTextWithoutDemoNumbers } from "@/lib/demo-visibility";

const OWNER_EMAIL = "seller.owner@gmail.com";

const pages = ["../app/b/[slug]/page.tsx", "../app/listings/[id]/page.tsx", "../app/people/[id]/page.tsx"];

test("public shop, listing, and profile pages do not render the owner's email", () => {
  for (const file of pages) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.equal(source.includes("email={"), false, file);
    assert.equal(source.includes("mailto:"), false, file);
    assert.equal(source.includes("application/ld+json"), false, file);
    assert.equal(source.includes("passwordHash"), false, file);
  }

  const contact = renderToStaticMarkup(
    createElement(SellerContactChannels, {
      hidden: false,
      note: "Contact details not available for this shop",
      phone: "+254722506974",
      whatsapp: "+254722506974",
      chatUrl: "https://wa.me/254722506974",
      callUrl: "tel:+254722506974",
    }),
  );
  assert.equal(contact.includes(OWNER_EMAIL), false);
  assert.equal(contact.includes("mailto:"), false);
  assert.match(contact, /Phone \+254722506974/);
  assert.match(contact, /WhatsApp \+254722506974/);
  assert.match(contact, /https:\/\/wa\.me\/254722506974/);
});

test("browse payloads and sharing cards drop the login email", () => {
  const card = toPublicListing({
    id: "list_1",
    contactPhone: "0722506974",
    contactWhatsapp: "+254722506974",
    owner: { email: OWNER_EMAIL, name: "Achieng", id: "user_1" },
  });
  const json = JSON.stringify(card);
  assert.equal(json.includes(OWNER_EMAIL), false);
  assert.equal(json.includes("gmail.com"), false);
  assert.equal("email" in card.owner, false);
  assert.equal(card.contactWhatsapp, "+254722506974");

  const demo = toPublicListing({
    contactPhone: "+254711000101",
    contactWhatsapp: "+254711000101",
    owner: { email: "atieno@dala.local", name: "Atieno" },
  });
  assert.equal(demo.contactPhone, "");
  assert.equal(demo.contactWhatsapp, "");
  assert.equal(JSON.stringify(demo).includes("atieno@dala.local"), false);
  assert.equal(JSON.stringify(demo).includes("254711000101"), false);

  const description = publicTextWithoutDemoNumbers(OWNER_EMAIL, "Fried tilapia in Kisumu.", ["+254722506974"]);
  assert.equal(description.includes(OWNER_EMAIL), false);
  assert.match(description, /Fried tilapia/);

  const shop = shopOgModel({
    brand: "Rangach",
    published: true,
    name: "Usenge Fish",
    city: "Nairobi",
    category: "Butchery & fish",
    coverUrl: "",
    logoUrl: "",
    verifiedPro: false,
  });
  const listing = listingOgModel({
    brand: "Rangach",
    hidden: false,
    title: "Fried tilapia",
    city: "Nairobi",
    category: "Butchery & fish",
    photoUrl: "",
  });
  assert.equal(JSON.stringify(shop).includes("@"), false);
  assert.equal(JSON.stringify(listing).includes("@"), false);

  const ogModel = readFileSync(new URL("./og-model.ts", import.meta.url), "utf8");
  const ogCard = readFileSync(new URL("./og-card.tsx", import.meta.url), "utf8");
  const ogLoad = readFileSync(new URL("./og-load.ts", import.meta.url), "utf8");
  assert.equal(ogModel.includes("email"), false);
  assert.equal(ogCard.includes("email"), false);
  assert.match(ogLoad, /isPublicDemoHidden\(shop\.user\.email\)/);
  assert.equal(/shopOgModel\(\{[^}]*email/.test(ogLoad), false);
  assert.equal(/listingOgModel\(\{[^}]*email/.test(ogLoad), false);
});

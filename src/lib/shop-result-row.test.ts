import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { ShopResultRow } from "@/components/shop-result-row";
import type { ShopCardData } from "@/lib/search";

function shop(whatsapp: string): ShopCardData {
  return {
    id: "shop_1",
    slug: "lake-tilapia",
    name: "Lake Tilapia",
    category: "Food & restaurants",
    city: "Nairobi",
    region: "homeland",
    verified: true,
    phoneVerified: true,
    locationVerified: false,
    businessVerified: false,
    servesDiaspora: false,
    coverUrl: "",
    avatarUrl: "",
    whatsapp,
  };
}

test("a shop row shows a WhatsApp circle without printing the number", () => {
  const html = renderToStaticMarkup(
    createElement(ShopResultRow, { shop: shop("+254722506974"), origin: "https://www.rangach.co.ke" }),
  );
  assert.match(html, /aria-label="WhatsApp Lake Tilapia"/);
  assert.match(html, /https:\/\/wa\.me\/254722506974/);
  assert.match(html, /Checked by Rangach/);
  const visible = html.replace(/href="[^"]*"/g, "");
  assert.equal(visible.includes("254722506974"), false);
  assert.equal(visible.includes("@"), false);
});

test("a shop row hides WhatsApp when the public number is blank", () => {
  const html = renderToStaticMarkup(createElement(ShopResultRow, { shop: shop(""), origin: "https://www.rangach.co.ke" }));
  assert.equal(html.includes("wa.me"), false);
  assert.equal(html.includes("WhatsApp"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { familyOrderMessage, familyOrderWhatsappLink, formatFamilyDate } from "@/lib/family-order";

const shop = {
  subjectName: "Mama Atieno's Kitchen",
  url: "https://www.rangach.co.ke/b/mama-atieno",
  siteName: "Rangach",
};

test("a family order with every detail is a polite WhatsApp note", () => {
  const message = familyOrderMessage({
    ...shop,
    recipientName: "  Akinyi   Odhiambo ",
    town: "Kisumu, Milimani",
    dateNeeded: "2026-12-20",
    payer: "me",
  });
  assert.equal(
    message,
    [
      "Hello, I found Mama Atieno's Kitchen on Rangach (https://www.rangach.co.ke/b/mama-atieno).",
      "",
      "I am buying for family back home.",
      "Recipient: Akinyi Odhiambo",
      "Town or area: Kisumu, Milimani",
      "Needed by: 20 December 2026",
      "Who is paying: I am paying.",
      "",
      "Please let me know if you can help. Thank you.",
    ].join("\n"),
  );
});

test("blank form fields still name the shop and the link", () => {
  const message = familyOrderMessage(shop);
  assert.match(message, /Hello, I found Mama Atieno's Kitchen on Rangach/);
  assert.match(message, /https:\/\/www\.rangach\.co\.ke\/b\/mama-atieno/);
  assert.match(message, /I am buying for family back home\./);
  assert.match(message, /Please let me know if you can help\. Thank you\./);
  assert.equal(message.includes("Recipient:"), false);
  assert.equal(message.includes("Town or area:"), false);
  assert.equal(message.includes("Needed by:"), false);
  assert.equal(message.includes("Who is paying:"), false);
});

test("an item or note is added only when the buyer filled it", () => {
  assert.equal(familyOrderMessage(shop).includes("What I need:"), false);
  assert.equal(familyOrderMessage(shop).includes("Notes:"), false);
  const message = familyOrderMessage({ ...shop, item: "plastic chairs", notes: "Saturday morning" });
  assert.match(message, /What I need: plastic chairs/);
  assert.match(message, /Notes: Saturday morning/);
});

test("who is paying uses the three choices and ignores anything else", () => {
  assert.match(familyOrderMessage({ ...shop, payer: "recipient" }), /The recipient will pay\./);
  assert.match(familyOrderMessage({ ...shop, payer: "other" }), /Someone else is paying\./);
  assert.equal(familyOrderMessage({ ...shop, payer: "seller" }).includes("Who is paying:"), false);
  assert.equal(familyOrderMessage({ ...shop, payer: "" }).includes("Who is paying:"), false);
});

test("an impossible date is left out, and a real one is written in words", () => {
  assert.equal(formatFamilyDate("2026-02-31"), "");
  assert.equal(formatFamilyDate("20 December 2026"), "");
  assert.equal(familyOrderMessage({ ...shop, dateNeeded: "2026-02-31" }).includes("Needed by:"), false);
  assert.match(familyOrderMessage({ ...shop, dateNeeded: "next Saturday" }), /Needed by: next Saturday/);
});

test("the WhatsApp link is wa.me with the same message filled in", () => {
  const link = familyOrderWhatsappLink("+254 711 000 101", {
    ...shop,
    recipientName: "Achieng",
    town: "Siaya",
    payer: "me",
  });
  const url = new URL(link);
  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/254711000101");
  const text = url.searchParams.get("text") ?? "";
  assert.match(text, /Mama Atieno's Kitchen/);
  assert.match(text, /https:\/\/www\.rangach\.co\.ke\/b\/mama-atieno/);
  assert.match(text, /Recipient: Achieng/);
  assert.match(text, /Town or area: Siaya/);
  assert.match(text, /Who is paying: I am paying\./);
  assert.equal(text.includes("payment"), false);
});

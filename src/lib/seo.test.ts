import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CITY_PAGES, cityPage, cityDescription, cityPageJsonLd, cityTitle, homeTitle, jsonLdString, organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { canonicalCity } from "@/lib/constants";

const origin = "https://www.rangach.co.ke";

test("homepage title is keyword-rich and keeps the brand", () => {
  const title = homeTitle("Rangach");
  assert.ok(title.startsWith("Rangach"));
  assert.match(title, /Luo/);
  assert.match(title, /Kenya/);
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.ok(layout.includes("default: homeTitle(name), template: `%s · ${name}`"));
});

test("city pages cover Kisumu, Siaya, Homa Bay with unique copy that maps to real towns", () => {
  assert.deepEqual(CITY_PAGES.map((page) => page.slug), ["kisumu", "siaya", "homa-bay"]);
  const titles = new Set(CITY_PAGES.map((page) => cityTitle(page)));
  const descriptions = new Set(CITY_PAGES.map((page) => cityDescription(page, "Rangach")));
  assert.equal(titles.size, 3);
  assert.equal(descriptions.size, 3);
  for (const page of CITY_PAGES) {
    assert.equal(canonicalCity(page.slug), page.city, page.slug);
    assert.equal(cityPage(page.slug), page);
  }
  assert.equal(cityPage("nowhere"), null);
});

test("SEO copy avoids funeral and escrow wording", () => {
  const copy = JSON.stringify(CITY_PAGES) + homeTitle("Rangach");
  assert.doesNotMatch(copy, /funeral|burial|escrow/i);
});

test("JSON-LD has no ratings, reviews, or prices", () => {
  const all = jsonLdString([
    organizationJsonLd(origin, "Rangach"),
    websiteJsonLd(origin, "Rangach"),
    ...CITY_PAGES.flatMap((page) => cityPageJsonLd(origin, "Rangach", page, [{ id: "l1", title: "Fundi" }])),
  ]);
  assert.doesNotMatch(all, /aggregateRating|ratingValue|"review|"price|"offers/i);
  assert.equal(organizationJsonLd(origin, "Rangach")["@type"], "Organization");
  assert.equal(websiteJsonLd(origin, "Rangach")["@type"], "WebSite");
  const types = cityPageJsonLd(origin, "Rangach", CITY_PAGES[0], [{ id: "l1", title: "x" }]).map((item) => item["@type"]);
  assert.deepEqual(types, ["CollectionPage", "BreadcrumbList", "ItemList"]);
});

test("jsonLdString cannot close the script tag", () => {
  const out = jsonLdString({ name: "</script><script>alert(1)</script>" });
  assert.equal(out.includes("</script>"), false);
  assert.deepEqual(JSON.parse(out), { name: "</script><script>alert(1)</script>" });
});

import assert from "node:assert/strict";
import test from "node:test";
import { applySearchParse } from "@/lib/ai/search-parse";
import type { SearchParse } from "@/lib/ai/prompts/smart-search";
import { chosenBrowseCity } from "@/lib/browse-filters";
import { CITIES, canonicalCity, registerCity } from "@/lib/constants";
import { parseNlQuery } from "@/lib/nl-query";
import { cataloguePlaceWhere, shopPlaceClauses } from "@/lib/search";
import { understoodChips } from "@/lib/understood-chips";

const blankAi: SearchParse = {
  category: null,
  city: null,
  region: null,
  occasion: null,
  type: null,
  keywords: "",
  language: "en",
  confidence: 0.9,
};

test("Kenyan towns start with Kisumu and the Diaspora list stays London", () => {
  assert.deepEqual(
    CITIES.map((city) => city.name),
    [
      "Kisumu",
      "Homa Bay",
      "Siaya",
      "Migori",
      "Kisii",
      "Bondo",
      "Kendu Bay",
      "Mbita",
      "Nakuru",
      "Eldoret",
      "Mombasa",
      "Nairobi",
      "London",
    ],
  );
  assert.deepEqual(
    CITIES.filter((city) => city.region === "diaspora").map((city) => city.name),
    ["London"],
  );
  assert.equal(CITIES.filter((city) => city.region === "homeland").every((city) => city.country === "Kenya"), true);
});

test("town spellings resolve without treating Kenya as Nairobi", () => {
  assert.equal(canonicalCity("kisumu"), "Kisumu");
  assert.equal(canonicalCity("KISUMU"), "Kisumu");
  assert.equal(canonicalCity("Kisumu city"), "Kisumu");
  assert.equal(canonicalCity("Homabay"), "Homa Bay");
  assert.equal(canonicalCity("Homa-Bay"), "Homa Bay");
  assert.equal(canonicalCity("homa bay"), "Homa Bay");
  assert.equal(canonicalCity("Kendu"), "Kendu Bay");
  assert.equal(canonicalCity("kendu-bay"), "Kendu Bay");
  assert.equal(canonicalCity("kenya"), "");
  assert.equal(canonicalCity("homeland"), "");
  assert.equal(canonicalCity(""), "");
  assert.equal(registerCity("Nairobi", "Kisumu"), "Kisumu");
  assert.equal(registerCity("Nairobi", ""), "Nairobi");
  assert.equal(registerCity("London", "Kisumu"), "London");
  assert.equal(registerCity("Kisumu", ""), "Kisumu");
  assert.equal(chosenBrowseCity("kisumu"), "Kisumu");
  assert.equal(chosenBrowseCity("", "Homa Bay"), "Homa Bay");
  assert.equal(chosenBrowseCity("not-a-town", "Kisumu"), "");
});

test("a town filter matches city or area text and a region filter does not require a town", () => {
  const regionOnly = cataloguePlaceWhere({ region: "homeland" });
  const regionJson = JSON.stringify(regionOnly);
  assert.equal(regionOnly.region, "homeland");
  assert.equal(regionJson.includes("city"), false);
  assert.equal(regionJson.includes("address"), false);

  const town = cataloguePlaceWhere({ city: "kisumu" }, { DATABASE_URL: "file:./dev.db" });
  const townJson = JSON.stringify(town);
  assert.match(townJson, /Kisumu/);
  assert.match(townJson, /"city"/);
  assert.match(townJson, /"address"/);
  assert.equal(townJson.includes("mode"), false);
  assert.equal(town.region, undefined);

  const both = cataloguePlaceWhere({ city: "Kisumu", region: "homeland" }, { DATABASE_URL: "postgresql://localhost/rangach" });
  assert.equal(both.region, "homeland");
  assert.match(JSON.stringify(both), /insensitive/);

  assert.deepEqual(shopPlaceClauses({ region: "homeland" }), [{ city: { not: "London" } }]);
  assert.deepEqual(shopPlaceClauses({ region: "diaspora" }), [{ city: "London" }]);
  const shopTown = JSON.stringify(shopPlaceClauses({ city: "Kisumu" }, { DATABASE_URL: "file:./dev.db" }));
  assert.match(shopTown, /Kisumu/);
  assert.match(shopTown, /bio/);
  assert.equal(cataloguePlaceWhere({ city: "Busia" }).AND, undefined);
});

test("sentence search sets homeland plus the town", () => {
  const fundi = parseNlQuery("fundi in Kisumu");
  assert.equal(fundi.city, "Kisumu");
  assert.equal(fundi.region, "homeland");
  assert.equal(fundi.category, "Construction & trades");
  assert.match(fundi.summary, /Kisumu/);

  const mechanic = parseNlQuery("mechanic near Kisumu");
  assert.equal(mechanic.city, "Kisumu");
  assert.equal(mechanic.region, "homeland");
  assert.equal(mechanic.category, "Auto & mechanics");
  assert.equal(mechanic.hints.includes("kisumu"), false);

  const dj = parseNlQuery("DJ for an ayie in Homa Bay");
  assert.equal(dj.city, "Homa Bay");
  assert.equal(dj.region, "homeland");
  assert.equal(dj.category, "Events & entertainment");
  assert.match(dj.summary, /Homa Bay/);
  assert.equal(dj.hints.includes("homa"), false);
  assert.equal(dj.hints.includes("bay"), false);
  assert.doesNotMatch(dj.summary, /funeral/i);

  const fish = parseNlQuery("fresh tilapia in Nairobi");
  assert.equal(fish.city, "Nairobi");
  assert.equal(fish.region, "homeland");
  assert.equal(fish.hints.includes("tilapia"), true);
  assert.equal(fish.hints.includes("nairobi"), false);

  const spellings = parseNlQuery("fundi in Kisumu city");
  assert.equal(spellings.city, "Kisumu");
  assert.equal(spellings.hints.includes("city"), false);
  assert.equal(parseNlQuery("mechanic in Homabay").city, "Homa Bay");
  assert.equal(parseNlQuery("mechanic in Homa-Bay").city, "Homa Bay");
  assert.equal(parseNlQuery("fundi in Kendu").city, "Kendu Bay");
  assert.equal(parseNlQuery("FUNDI IN KISUMU").city, "Kisumu");
  assert.equal(parseNlQuery("kenya fundi in Kisumu").city, "Kisumu");

  const read = applySearchParse(parseNlQuery("mechanic near homabay"), { ...blankAi, city: "Homabay" });
  assert.equal(read.city, "Homa Bay");
  assert.equal(read.region, "homeland");
  const chip = understoodChips("/listings", { city: read.city, region: read.region, nl: "mechanic near homabay" }).find(
    (item) => item.key === "city",
  );
  assert.equal(chip?.label, "Homa Bay");
});

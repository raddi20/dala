import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TOWNS } from "@/lib/constants";
import {
  TOWN_CENTROIDS,
  distanceLabel,
  distanceToShop,
  haversineKm,
  nearParam,
  parseNear,
  shopPoint,
  sortByDistance,
} from "@/lib/near-me";

test("every town in the catalogue has a centre, inside Kenya", () => {
  for (const town of TOWNS) {
    const point = TOWN_CENTROIDS[town.name];
    assert.ok(point, town.name);
    assert.ok(point.lat > -5 && point.lat < 5 && point.lng > 33 && point.lng < 42, town.name);
  }
});

test("?near= is validated and rounded to about 1 km", () => {
  assert.deepEqual(parseNear("-0.09174,34.76801"), { lat: -0.09, lng: 34.77 });
  assert.equal(parseNear(""), null);
  assert.equal(parseNear("95,10"), null);
  assert.equal(parseNear("1,200"), null);
  assert.equal(parseNear("abc"), null);
  assert.equal(parseNear("1;DROP"), null);
  assert.equal(nearParam({ lat: -1.292066, lng: 36.821945 }), "-1.29,36.82");
});

test("distance uses the shop pin first, then its town centre, else unknown", () => {
  const kisumu = TOWN_CENTROIDS.Kisumu;
  assert.ok(Math.abs(haversineKm(kisumu, TOWN_CENTROIDS.Nairobi) - 265) < 15);
  assert.deepEqual(shopPoint({ latitude: 1, longitude: 35, city: "Kisumu" }), { lat: 1, lng: 35 });
  assert.deepEqual(shopPoint({ latitude: null, longitude: null, city: "kisumu" }), kisumu);
  assert.equal(shopPoint({ city: "Atlantis" }), null);
  assert.equal(distanceToShop(kisumu, { city: "Kisumu" }), 0);
  assert.equal(distanceToShop(kisumu, { city: "" }), null);
});

test("nearest first, unknown places last in their old order", () => {
  const rows = [
    { id: "nairobi", distanceKm: 265 },
    { id: "unknown-a", distanceKm: null },
    { id: "kisumu", distanceKm: 0 },
    { id: "unknown-b", distanceKm: null },
    { id: "kisii", distanceKm: 66 },
  ];
  assert.deepEqual(sortByDistance(rows).map((row) => row.id), ["kisumu", "kisii", "nairobi", "unknown-a", "unknown-b"]);
  assert.equal(distanceLabel(0.4), "In your town");
  assert.equal(distanceLabel(66.2), "About 66 km away");
  assert.equal(distanceLabel(null), "");
});

test("Near me is opt-in, has a denied fallback, and the schema change is nullable", () => {
  const client = readFileSync(new URL("../components/near-me.tsx", import.meta.url), "utf8");
  assert.match(client, /getCurrentPosition/);
  assert.match(client, /PERMISSION_DENIED/);
  assert.match(client, /Location is off, so shops stay in the usual order/);
  assert.match(client, /onClick=\{ask\}/);
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /latitude\s+Float\?/);
  assert.match(schema, /longitude\s+Float\?/);
  const page = readFileSync(new URL("../app/shops/page.tsx", import.meta.url), "utf8");
  assert.match(page, /parseNear\(one\(sp\.near\)\)/);
});

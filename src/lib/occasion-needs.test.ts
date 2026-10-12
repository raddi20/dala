import assert from "node:assert/strict";
import test from "node:test";
import { AYIE_NEEDS_HEADING, familiesAlsoNeed } from "@/lib/occasion-needs";

test("families also need is the ayie set only", () => {
  assert.equal(familiesAlsoNeed(""), null);
  assert.equal(familiesAlsoNeed("homecomings"), null);
  assert.equal(familiesAlsoNeed("funerals"), null);
  assert.equal(familiesAlsoNeed("christmas-at-home"), null);

  const band = familiesAlsoNeed("weddings-dowry");
  assert.ok(band);
  assert.equal(band.heading, AYIE_NEEDS_HEADING);
  assert.equal(band.heading, "Planning an ayie? Families also need");
  assert.doesNotMatch(band.heading, /funeral/i);
  assert.deepEqual(
    band.items.map((item) => item.label),
    ["Tents & chairs", "PA", "Transport", "Fish"],
  );
  assert.ok(band.items[0]?.href.includes("Tents"));
  assert.ok(band.items[1]?.href.includes("Music"));
  assert.ok(band.items[2]?.href.includes("Transport"));
  assert.ok(band.items[3]?.href.includes("fresh"));
  assert.ok(band.items[3]?.href.includes("tilapia"));
  for (const item of band.items) assert.doesNotMatch(`${item.label} ${item.href}`, /funeral/i);
});

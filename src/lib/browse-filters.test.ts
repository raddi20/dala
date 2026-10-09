import assert from "node:assert/strict";
import test from "node:test";
import { activeBrowseRegion, browseRegionChipHref, browseRegionFromCity } from "@/lib/browse-filters";

test("old city links map onto homeland and diaspora chips", () => {
  assert.equal(browseRegionFromCity("Nairobi"), "homeland");
  assert.equal(browseRegionFromCity("London"), "diaspora");
  assert.equal(browseRegionFromCity(""), "");
  assert.equal(browseRegionFromCity("Kisumu"), "");
});

test("an explicit region wins over a city link", () => {
  assert.equal(activeBrowseRegion("London", ""), "diaspora");
  assert.equal(activeBrowseRegion("Nairobi", ""), "homeland");
  assert.equal(activeBrowseRegion("", "diaspora"), "diaspora");
  assert.equal(activeBrowseRegion("", "homeland"), "homeland");
  assert.equal(activeBrowseRegion("Nairobi", "diaspora"), "diaspora");
  assert.equal(activeBrowseRegion("London", "homeland"), "homeland");
  assert.equal(activeBrowseRegion("", ""), "");
});

test("region chips drop the city param and toggle the active region", () => {
  const london = { q: "plot", city: "London", region: "", type: "business", category: "" };
  assert.equal(browseRegionChipHref(london, "diaspora"), "/listings?q=plot&type=business");
  assert.equal(browseRegionChipHref(london, "homeland"), "/listings?q=plot&region=homeland&type=business");

  const nairobi = { city: "Nairobi", q: "matoke" };
  assert.equal(browseRegionChipHref(nairobi, "homeland"), "/listings?q=matoke");
  assert.equal(browseRegionChipHref(nairobi, "diaspora"), "/listings?q=matoke&region=diaspora");

  assert.equal(browseRegionChipHref({ city: "Nairobi", region: "diaspora" }, "diaspora"), "/listings");
  assert.equal(
    browseRegionChipHref({ region: "homeland", category: "Food" }, "diaspora"),
    "/listings?region=diaspora&category=Food",
  );
  assert.equal(browseRegionChipHref({ region: "diaspora" }, "diaspora"), "/listings");
  assert.equal(browseRegionChipHref({}, "homeland"), "/listings?region=homeland");
});

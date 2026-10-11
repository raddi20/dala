import assert from "node:assert/strict";
import test from "node:test";
import { parseListingForm } from "@/lib/validators";
import {
  canonicalE164,
  commitPhonePlans,
  countryForCity,
  normalizeContactPair,
  parsePhone,
  planPhoneRow,
  renderPhoneReport,
  splitPhoneInput,
  telHref,
  waMeDigits,
  type PhoneRow,
} from "@/lib/phone";
import { telHref as telHrefFromUtils } from "@/lib/utils";
import { whatsappChatLink, whatsappOfferingLink, whatsappShareLink, whatsappShopLink } from "@/lib/whatsapp";

test("the city picks Kenya or the UK, and anything else stays Kenya", () => {
  assert.equal(countryForCity("Nairobi"), "KE");
  assert.equal(countryForCity("  london "), "GB");
  assert.equal(countryForCity("London"), "GB");
  assert.equal(countryForCity("Kisumu"), "KE");
  assert.equal(countryForCity(""), "KE");
});

test("Kenyan mobiles become +254 and UK numbers become +44", () => {
  const kenya = [
    "0722506974",
    "0722 506 974",
    "0722-506-974",
    "(0722) 506 974",
    "722506974",
    "254722506974",
    "+254722506974",
    "+254 722 506 974",
    "0112345678",
    "112345678",
    "+254112345678",
    "254 112 345 678",
    "+2540722506974",
    "00254722506974",
  ];
  for (const value of kenya) {
    const parsed = parsePhone(value, "KE");
    assert.equal(parsed.ok, true, value);
    if (parsed.ok) {
      assert.equal(parsed.e164.startsWith("+254"), true, `${value} → ${parsed.e164}`);
      assert.match(parsed.e164, /^\+254[17]\d{8}$/);
    }
  }
  assert.equal((parsePhone("0722506974", "KE") as { e164: string }).e164, "+254722506974");
  assert.equal((parsePhone("0703727499", "KE") as { e164: string }).e164, "+254703727499");
  assert.equal((parsePhone("0112345678", "KE") as { e164: string }).e164, "+254112345678");

  assert.equal((parsePhone("07123456789", "GB") as { e164: string }).e164, "+447123456789");
  assert.equal((parsePhone("+44 7123 456789", "KE") as { e164: string }).e164, "+447123456789");
  assert.equal((parsePhone("447123456789", "KE") as { e164: string }).e164, "+447123456789");
  assert.equal((parsePhone("+4407123456789", "GB") as { e164: string }).e164, "+447123456789");
  assert.equal((parsePhone("020 7946 0958", "GB") as { e164: string }).e164, "+442079460958");
});

test("a 10-digit 07 number is Kenya even in London, and an 11-digit 07 number is UK even in Nairobi", () => {
  assert.equal((parsePhone("0722506974", "GB") as { e164: string }).e164, "+254722506974");
  assert.equal((parsePhone("07123456789", "KE") as { e164: string }).e164, "+447123456789");
  assert.equal((parsePhone("712345678", "GB") as { e164: string }).e164, "+254712345678");
  assert.equal((parsePhone("7123456789", "KE") as { e164: string }).e164, "+447123456789");
});

test("a 13-digit 254 number and other junk are refused with a clear reason", () => {
  const tooMany = parsePhone("2547266444175", "KE");
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.match(tooMany.error, /too many digits/);

  const short = parsePhone("07123", "KE");
  assert.equal(short.ok, false);
  if (!short.ok) assert.match(short.error, /too short/);

  const words = parsePhone("call me later", "KE");
  assert.equal(words.ok, false);
  if (!words.ok) assert.match(words.error, /digits only/);

  const landline = parsePhone("0201234567", "KE");
  assert.equal(landline.ok, false);
});

test("two numbers in one field split, and a formatted single number does not", () => {
  assert.deepEqual(splitPhoneInput("0722 506 974"), ["0722 506 974"]);
  assert.deepEqual(splitPhoneInput("+254 722 506 974"), ["+254 722 506 974"]);
  assert.deepEqual(splitPhoneInput("(0722) 506-974"), ["(0722) 506-974"]);
  assert.deepEqual(splitPhoneInput("0722,506,974"), ["0722,506,974"]);

  assert.deepEqual(splitPhoneInput("+254721642805+254738209115"), ["+254721642805", "+254738209115"]);
  assert.deepEqual(splitPhoneInput("0722506974 / 0738209115"), ["0722506974", "0738209115"]);
  assert.deepEqual(splitPhoneInput("0722506974 or 0738209115"), ["0722506974", "0738209115"]);
  assert.deepEqual(splitPhoneInput("0722506974 and 0738209115"), ["0722506974", "0738209115"]);
  assert.deepEqual(splitPhoneInput("0722506974, 0738209115"), ["0722506974", "0738209115"]);
  assert.deepEqual(splitPhoneInput("07225069740738209115"), ["0722506974", "0738209115"]);
  assert.deepEqual(splitPhoneInput("254721642805254738209115"), ["254721642805", "254738209115"]);
});

test("the second number fills an empty partner field, and is reported when that field is taken", () => {
  const split = normalizeContactPair({
    phone: "+254721642805+254738209115",
    whatsapp: "",
    city: "Nairobi",
  });
  assert.deepEqual(split, { ok: true, phone: "+254721642805", whatsapp: "+254738209115" });

  const taken = normalizeContactPair({
    phone: "0722506974 / 0738209115",
    whatsapp: "+254700000000",
    city: "Nairobi",
  });
  assert.equal(taken.ok, false);
  if (!taken.ok) {
    assert.equal(taken.field, "phone");
    assert.match(taken.error, /two numbers/);
    assert.match(taken.error, /\+254738209115/);
  }

  const same = normalizeContactPair({
    phone: "0722506974",
    whatsapp: "+254 722 506 974",
    city: "Nairobi",
  });
  assert.deepEqual(same, { ok: true, phone: "+254722506974", whatsapp: "+254722506974" });
});

test("listing and profile saves store E.164 and keep an empty number", () => {
  const form = new FormData();
  form.set("title", "Fried tilapia");
  form.set("description", "Fresh fish from the lake, fried to order.");
  form.set("category", "Food & restaurants");
  form.set("city", "Nairobi");
  form.set("type", "business");
  form.set("contactPhone", "0703727499");
  form.set("contactWhatsapp", "0722 506 974");
  const parsed = parseListingForm(form);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.data.contactPhone, "+254703727499");
    assert.equal(parsed.data.contactWhatsapp, "+254722506974");
  }

  const london = new FormData();
  london.set("title", "Airport run");
  london.set("description", "A car from Thamesmead to the airport.");
  london.set("category", "Transport & logistics");
  london.set("city", "London");
  london.set("type", "services");
  london.set("contactPhone", "07123 456789");
  const uk = parseListingForm(london);
  assert.equal(uk.ok, true);
  if (uk.ok) assert.equal(uk.data.contactPhone, "+447123456789");

  const bad = new FormData();
  bad.set("title", "Samurai kicks");
  bad.set("description", "Shoes from the shop on the main road.");
  bad.set("category", "Fashion & clothing");
  bad.set("city", "Nairobi");
  bad.set("type", "business");
  bad.set("contactWhatsapp", "2547266444175");
  const refused = parseListingForm(bad);
  assert.equal(refused.ok, false);
  if (!refused.ok) {
    assert.equal(refused.field, "contactWhatsapp");
    assert.match(refused.error, /too many digits/);
  }

  const blank = normalizeContactPair({ phone: "", whatsapp: "  ", city: "Nairobi" });
  assert.deepEqual(blank, { ok: true, phone: "", whatsapp: "" });
});

test("wa.me and tel links are built only from E.164", () => {
  assert.equal(waMeDigits("+254722506974"), "254722506974");
  assert.equal(waMeDigits("+254 722 506 974"), "254722506974");
  assert.equal(waMeDigits("0722506974"), "");
  assert.equal(waMeDigits("2547266444175"), "");
  assert.equal(waMeDigits("+254721642805+254738209115"), "");
  assert.equal(telHref("+254703727499"), "tel:+254703727499");
  assert.equal(telHref("0703727499"), "");
  assert.equal(telHrefFromUtils("+254 729 217 350"), "tel:+254729217350");
  assert.equal(canonicalE164("+447123456789"), "+447123456789");

  assert.equal(whatsappChatLink("0722506974", "Airbnb"), "");
  assert.equal(whatsappShopLink("2547266444175", "https://www.rangach.co.ke/b/samurai"), "");
  assert.match(whatsappOfferingLink("+254722506974", "Fried tilapia", "https://www.rangach.co.ke/b/usenge-fish"), /^https:\/\/wa\.me\/254722506974\?text=/);
  const share = new URL(whatsappShareLink("A shop", "https://www.rangach.co.ke/b/usenge-fish"));
  assert.equal(share.origin, "https://wa.me");
  assert.equal(share.pathname, "/");
});

/**
 * The live rows from the 11 Oct 2026 audit.
 * wa.me/0722506974, wa.me/2547266444175, tel:+254721642805+254738209115, tel:0703727499.
 * Treated here as listing contact fields. The script prints User rows the same way.
 */
const auditRows: PhoneRow[] = [
  { kind: "listing", id: "cmuo8t1770002jp04rx5mt33c", city: "Nairobi", phone: "", whatsapp: "0722506974" },
  { kind: "listing", id: "cmv3w2lcb0001l806yoc1j4qq", city: "Nairobi", phone: "", whatsapp: "2547266444175" },
  { kind: "listing", id: "cmuljy7x70004ia0475yfcv58", city: "Nairobi", phone: "+254721642805+254738209115", whatsapp: "" },
  { kind: "listing", id: "cmuzohjmr0002l804o96n4c1h", city: "Nairobi", phone: "0703727499", whatsapp: "" },
];

const auditDryRun = [
  "DRY RUN. No rows were written. Run again with --apply to update.",
  "",
  "Listing cmuo8t1770002jp04rx5mt33c (Nairobi)",
  "  contactWhatsapp: 0722506974 → +254722506974",
  "",
  "Listing cmv3w2lcb0001l806yoc1j4qq (Nairobi)",
  "  contactWhatsapp: 2547266444175 → (unchanged)",
  "  report: That number has too many digits. A Kenyan mobile looks like 0712 345 678.",
  "",
  "Listing cmuljy7x70004ia0475yfcv58 (Nairobi)",
  "  contactPhone: +254721642805+254738209115 → +254721642805",
  "  contactWhatsapp: (empty) → +254738209115",
  "",
  "Listing cmuzohjmr0002l804o96n4c1h (Nairobi)",
  "  contactPhone: 0703727499 → +254703727499",
  "",
  "Would update 3 rows. 1 row reported. 0 rows already fine.",
].join("\n");

test("the cleanup dry run prints the audit rows and does not write", async () => {
  const plans = auditRows.map(planPhoneRow);
  assert.equal(renderPhoneReport(plans, false), auditDryRun);
  let writes = 0;
  const written = await commitPhonePlans(plans, false, async () => {
    writes += 1;
  });
  assert.equal(written, 0);
  assert.equal(writes, 0);
});

test("apply writes the three fixable audit rows once, then a second run is a no-op", async () => {
  const plans = auditRows.map(planPhoneRow);
  const stored = new Map(auditRows.map((row) => [row.id, { ...row }]));
  const written = await commitPhonePlans(plans, true, async (plan) => {
    const row = stored.get(plan.id);
    if (!row) return;
    row.phone = plan.phone;
    row.whatsapp = plan.whatsapp;
  });
  assert.equal(written, 3);
  assert.equal(stored.get("cmuo8t1770002jp04rx5mt33c")?.whatsapp, "+254722506974");
  assert.equal(stored.get("cmv3w2lcb0001l806yoc1j4qq")?.whatsapp, "2547266444175");
  assert.equal(stored.get("cmuljy7x70004ia0475yfcv58")?.phone, "+254721642805");
  assert.equal(stored.get("cmuljy7x70004ia0475yfcv58")?.whatsapp, "+254738209115");
  assert.equal(stored.get("cmuzohjmr0002l804o96n4c1h")?.phone, "+254703727499");

  const again = [...stored.values()].map(planPhoneRow);
  assert.equal(again.some((plan) => plan.changed), false);
  const second = await commitPhonePlans(again, true, async () => {
    assert.fail("already normalised rows must not be written");
  });
  assert.equal(second, 0);
  const secondReport = renderPhoneReport(again, false);
  assert.match(secondReport, /Would update 0 rows/);
  assert.match(secondReport, /2547266444175 → \(unchanged\)/);
  assert.match(secondReport, /too many digits/);
  assert.match(renderPhoneReport(again, true), /^APPLY\. The rows below were written\./);
});

test("a second number is reported when the partner field already has a different number", () => {
  const plan = planPhoneRow({
    kind: "user",
    id: "user_renarene",
    city: "Nairobi",
    phone: "+254721642805+254738209115",
    whatsapp: "+254700000001",
  });
  assert.equal(plan.changed, true);
  assert.equal(plan.phone, "+254721642805");
  assert.equal(plan.whatsapp, "+254700000001");
  assert.equal(plan.reports.length, 1);
  const text = renderPhoneReport([plan], false);
  assert.match(text, /User user_renarene \(Nairobi\)/);
  assert.match(text, /phone: \+254721642805\+254738209115 → \+254721642805/);
  assert.match(text, /report: Phone has two numbers\. \+254738209115 was not saved/);
});

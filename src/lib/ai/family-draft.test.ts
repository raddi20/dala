import assert from "node:assert/strict";
import test from "node:test";
import { draftFamilyOrder, nairobiToday } from "@/lib/ai/family-draft";
import type { FamilyHelperResult } from "@/lib/ai/prompts/family-helper";
import { familyOrderMessage } from "@/lib/family-order";
import type { RunResult } from "@/lib/ai/types";

const filled: FamilyHelperResult = {
  item: "plastic chairs",
  recipientName: "Akinyi",
  town: "Siaya",
  dateNeeded: "2026-12-20",
  payer: "recipient",
  notes: "For a funeral",
};

function okRun(data: FamilyHelperResult = filled) {
  let calls = 0;
  const run = async () => {
    calls += 1;
    const result: RunResult<FamilyHelperResult> = {
      ok: true,
      data,
      provider: "mock",
      model: "mock",
      costMicroUsd: 0,
      latencyMs: 1,
    };
    return result;
  };
  return { run, calls: () => calls };
}

test("a missing visitor or a disabled model does not fill the form", async () => {
  const writer = okRun();
  const anonymous = await draftFamilyOrder({ text: "chairs for my mother in Siaya" }, { run: writer.run, actorHash: null });
  assert.equal(anonymous.ok, false);
  if (!anonymous.ok) assert.equal(anonymous.status, 429);
  assert.equal(writer.calls(), 0);

  const disabled = await draftFamilyOrder(
    { text: "chairs for my mother in Siaya" },
    { actorHash: "abc", run: async () => ({ ok: false, kind: "disabled" }) },
  );
  assert.equal(disabled.ok, false);
  if (!disabled.ok) assert.equal(disabled.status, 503);

  const capped = await draftFamilyOrder(
    { text: "chairs for my mother in Siaya" },
    { actorHash: "abc", run: async () => ({ ok: false, kind: "rate_capped" }) },
  );
  assert.equal(capped.ok, false);
  if (!capped.ok) assert.equal(capped.status, 429);
});

test("a sentence fills the form, drops a past date, and does not open WhatsApp", async () => {
  const writer = okRun({ ...filled, dateNeeded: "2020-01-01", payer: "nope" as FamilyHelperResult["payer"] });
  const now = new Date("2026-10-01T12:00:00Z");
  const result = await draftFamilyOrder(
    { text: "chairs for Akinyi in Siaya", subjectName: "Mama Atieno" },
    { now, actorHash: "visitor-hash", run: writer.run },
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.fields.recipientName, "Akinyi");
    assert.equal(result.fields.town, "Siaya");
    assert.equal(result.fields.item, "plastic chairs");
    assert.equal(result.fields.dateNeeded, "");
    assert.equal(result.fields.payer, "");
  }
  assert.equal(writer.calls(), 1);
  assert.equal(nairobiToday(now), "2026-10-01");

  const blank = familyOrderMessage({
    subjectName: "Mama Atieno's Kitchen",
    url: "https://www.rangach.co.ke/b/mama-atieno",
    siteName: "Rangach",
  });
  assert.equal(blank.includes("What I need:"), false);
  const withItem = familyOrderMessage({
    subjectName: "Mama Atieno's Kitchen",
    url: "https://www.rangach.co.ke/b/mama-atieno",
    siteName: "Rangach",
    item: "plastic chairs",
  });
  assert.match(withItem, /What I need: plastic chairs/);
  assert.equal(withItem.includes("https://wa.me"), false);

  const empty = await draftFamilyOrder({ text: "" }, { actorHash: "visitor-hash", run: writer.run });
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.fields.item, "");
  assert.equal(writer.calls(), 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import { isAiFeatureOn } from "@/lib/ai/flags";

test("a feature is on only when the env flag is 1 and the database has not switched it off", async () => {
  const open = async () => null;
  const killed = async () => false;
  const allowed = async () => true;
  const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;
  assert.equal(await isAiFeatureOn("smart_search", { env: env({}), lookup: open }), false);
  assert.equal(await isAiFeatureOn("smart_search", { env: env({ AI_SMART_SEARCH: "true" }), lookup: open }), false);
  assert.equal(await isAiFeatureOn("smart_search", { env: env({ AI_SMART_SEARCH: "1" }), lookup: open }), true);
  assert.equal(await isAiFeatureOn("smart_search", { env: env({ AI_SMART_SEARCH: "1" }), lookup: allowed }), true);
  assert.equal(await isAiFeatureOn("smart_search", { env: env({ AI_SMART_SEARCH: "1" }), lookup: killed }), false);
  assert.equal(await isAiFeatureOn("listing_writer", { env: env({ AI_LISTING_WRITER: "1" }), lookup: killed }), false);
});

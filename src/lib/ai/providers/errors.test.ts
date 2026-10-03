import assert from "node:assert/strict";
import test from "node:test";
import { AiError } from "@/lib/ai/types";
import { asAiError, sanitizeProviderDetail } from "@/lib/ai/providers/errors";

test("a missing model is not stored as a timeout", () => {
  const missing = asAiError(
    Object.assign(new Error(JSON.stringify({ error: { code: 404, status: "NOT_FOUND", message: "models/gemini-old is not found" } })), {
      status: 404,
    }),
    null,
    Date.now(),
  );
  assert.ok(missing instanceof AiError);
  assert.equal(missing.kind, "model_not_found");
  assert.match(missing.message, /HTTP 404/);
  assert.match(missing.message, /NOT_FOUND/);
  assert.equal(missing.message.includes("gemini-old"), true);

  const bad = asAiError(
    Object.assign(new Error(JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT", message: "thinking level is invalid" } })), {
      status: 400,
    }),
    null,
    Date.now(),
  );
  assert.equal(bad.kind, "bad_request");
  assert.match(bad.message, /HTTP 400/);

  const timed = asAiError(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }), null, Date.now());
  assert.equal(timed.kind, "timeout");
  assert.equal(timed.message, "The model timed out.");
});

test("provider details drop keys and stay short", () => {
  const detail = sanitizeProviderDetail(401, "UNAUTHENTICATED", "API key AIzaSyThisIsASecretKeyValue rejected");
  assert.equal(detail.includes("AIza"), false);
  assert.match(detail, /HTTP 401/);
  assert.match(detail, /\[key\]/);
  assert.ok(detail.length <= 300);
});

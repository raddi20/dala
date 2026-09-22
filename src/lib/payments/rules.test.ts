import assert from "node:assert/strict";
import test from "node:test";
import {
  amountsMatch,
  classifySecret,
  isFlutterwaveCheckoutUrl,
  normalizeMpesaPhone,
  parseVerifyBody,
  parseWebhook,
  safeEqual,
} from "./rules";

test("classifySecret distinguishes test, live, and junk", () => {
  assert.equal(classifySecret(""), "missing");
  assert.equal(classifySecret("  "), "missing");
  assert.equal(classifySecret("FLWSECK_TEST-sandbox"), "test");
  assert.equal(classifySecret("FLWSECK-live"), "live");
  assert.equal(classifySecret("sk_test_paystack"), "invalid");
});

test("normalizeMpesaPhone accepts Safaricom shapes", () => {
  assert.equal(normalizeMpesaPhone("0712 345 678"), "254712345678");
  assert.equal(normalizeMpesaPhone("+254712345678"), "254712345678");
  assert.equal(normalizeMpesaPhone("254112345678"), "254112345678");
  assert.equal(normalizeMpesaPhone("712345678"), "254712345678");
  assert.equal(normalizeMpesaPhone("12345"), null);
  assert.equal(normalizeMpesaPhone("+447911123456"), null);
});

test("amountsMatch uses major units", () => {
  assert.equal(amountsMatch(1500, 1500), true);
  assert.equal(amountsMatch(12, 12.0), true);
  assert.equal(amountsMatch(1500, 1501), false);
  assert.equal(amountsMatch(20, Number.NaN), false);
});

test("safeEqual rejects empty and mismatched secrets", () => {
  assert.equal(safeEqual("hash", "hash"), true);
  assert.equal(safeEqual("hash", "other"), false);
  assert.equal(safeEqual("", ""), false);
  assert.equal(safeEqual("hash", "hash-extra"), false);
});

test("checkout links stay on Flutterwave", () => {
  assert.equal(isFlutterwaveCheckoutUrl("https://checkout.flutterwave.com/v3/hosted/pay/abc"), true);
  assert.equal(isFlutterwaveCheckoutUrl("http://checkout.flutterwave.com/v3/hosted/pay/abc"), false);
  assert.equal(isFlutterwaveCheckoutUrl("https://evil.example/checkout.flutterwave.com"), false);
  assert.equal(isFlutterwaveCheckoutUrl("https://checkout.flutterwave.com.evil.test/pay"), false);
});

test("webhook and verify payloads expose the charged amount", () => {
  const charge = {
    id: 1191376,
    tx_ref: "dala_abc",
    amount: 1500,
    currency: "KES",
    status: "successful",
    payment_type: "mpesa",
  };
  const webhook = parseWebhook({ event: "charge.completed", data: charge });
  assert.equal(webhook?.event, "charge.completed");
  assert.equal(webhook?.charge?.providerId, "1191376");
  assert.equal(webhook?.charge?.method, "mpesa");
  assert.equal(webhook?.charge?.reference, "dala_abc");

  const verified = parseVerifyBody({ status: "success", data: { ...charge, amount: "20", currency: "gbp", payment_type: "card", status: "successful" } });
  assert.equal(verified?.amount, 20);
  assert.equal(verified?.currency, "GBP");
  assert.equal(verified?.method, "card");

  assert.equal(parseVerifyBody({ status: "error", data: charge }), null);
  assert.equal(parseWebhook({ event: "charge.completed" })?.charge, null);
  assert.equal(parseWebhook({}), null);
});

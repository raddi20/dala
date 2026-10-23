import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { initialiseTransaction, refundTransaction } from "@/lib/paystack";
import { limitOrderCollect } from "@/lib/rate-limit";
import {
  ORDER_STATUS_LABEL,
  PROTECTED_ORDER_COPY,
  UNDELIVERED_AFTER_MS,
  applyPaid,
  commissionPercent,
  deliverWithCode,
  deliveryChoices,
  kesLabelFromSubunit,
  newCollectCode,
  paystackInitializeRequest,
  paystackSignatureOk,
  protectedOrdersOn,
  quoteSubunits,
  readChargeSuccess,
  refundAllowed,
  shouldFlagUndelivered,
  subaccountCodeOk,
  type OrderSnapshot,
} from "@/lib/protected-order";

const secret = "sk_test_example";

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: "test", ...values };
}

function snapshot(overrides: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    id: "ord_1",
    status: "pending_payment",
    paystackReference: "po_abc",
    itemsSubunit: 150_000,
    deliverySubunit: 20_000,
    collectCode: "123456",
    paidAt: null,
    ...overrides,
  };
}

function charge(amount = 170_000) {
  return {
    eventId: "charge.success:po_abc:9",
    reference: "po_abc",
    amountSubunit: amount,
    currency: "KES",
    status: "success",
  };
}

test("protected orders stay off until the flag is on, and the commission defaults to 4", () => {
  assert.equal(protectedOrdersOn(env({})), false);
  assert.equal(protectedOrdersOn(env({ PROTECTED_ORDERS: "off" })), false);
  assert.equal(protectedOrdersOn(env({ PROTECTED_ORDERS: "1" })), true);
  assert.equal(commissionPercent(env({})), 4);
  assert.equal(commissionPercent(env({ PROTECTED_ORDER_COMMISSION_PERCENT: "7" })), 7);
  assert.equal(commissionPercent(env({ PROTECTED_ORDER_COMMISSION_PERCENT: "nope" })), 4);
  assert.equal(newCollectCode(() => 7), "000007");
});

test("a split initialises on the shop subaccount with a 4 percent commission", () => {
  const quote = quoteSubunits([{ qty: 1, unitSubunit: 150_000 }], 200);
  assert.deepEqual(quote, { itemsSubunit: 150_000, deliverySubunit: 20_000, amountSubunit: 170_000 });
  const request = paystackInitializeRequest({
    secret,
    email: "akinyi@example.com",
    amountSubunit: quote.amountSubunit,
    reference: "po_abc",
    subaccount: "ACCT_TILAPIA",
    percent: commissionPercent(env({})),
    callbackUrl: "https://www.rangach.co.ke/orders/po_abc",
  });
  assert.equal(request.url, "https://api.paystack.co/transaction/initialize");
  assert.equal(request.headers.Authorization, `Bearer ${secret}`);
  assert.equal(request.body.amount, 170_000);
  assert.equal(request.body.currency, "KES");
  assert.equal(request.body.subaccount, "ACCT_TILAPIA");
  assert.equal(request.body.percentage_charge, 4);
  assert.equal(request.body.bearer, "subaccount");
  assert.equal(kesLabelFromSubunit(170_000), "KES 1,700");
});

test("the webhook signature must match, and a repeat or a wrong amount does not mark paid", () => {
  const body = JSON.stringify({ event: "charge.success", data: { id: 9, reference: "po_abc", amount: 170_000, currency: "KES", status: "success" } });
  const signature = createHmac("sha512", secret).update(body).digest("hex");
  assert.equal(paystackSignatureOk(body, signature, secret), true);
  assert.equal(paystackSignatureOk(body, signature, "other"), false);
  assert.equal(paystackSignatureOk(body, "", secret), false);
  const parsed = readChargeSuccess(JSON.parse(body));
  assert.equal(parsed?.eventId, "charge.success:po_abc:9");
  const now = new Date("2026-10-14T12:00:00.000Z");
  const paid = applyPaid(snapshot(), charge(), false, now);
  assert.equal(paid.changed, true);
  assert.equal(paid.status, "paid");
  assert.equal(applyPaid(snapshot(), charge(1), false, now).changed, false);
  assert.equal(applyPaid(snapshot(), charge(), true, now).changed, false);
  assert.equal(applyPaid(snapshot({ status: "paid", paidAt: now }), charge(), false, now).changed, false);
  assert.equal(readChargeSuccess({ event: "transfer.success" }), null);
});

test("delivery uses the collect code, and 72 hours flags an unpaid delivery", () => {
  const paidAt = new Date("2026-10-11T12:00:00.000Z");
  const order = snapshot({ status: "out_for_delivery", paidAt });
  assert.equal(deliverWithCode(order, "000000", paidAt).ok, false);
  const delivered = deliverWithCode(order, "123456", paidAt);
  assert.equal(delivered.ok, true);
  if (delivered.ok) assert.equal(delivered.status, "delivered");
  assert.equal(shouldFlagUndelivered(order, new Date(paidAt.getTime() + UNDELIVERED_AFTER_MS - 1)), false);
  assert.equal(shouldFlagUndelivered(order, new Date(paidAt.getTime() + UNDELIVERED_AFTER_MS)), true);
  assert.equal(shouldFlagUndelivered(snapshot({ status: "delivered", paidAt }), new Date(paidAt.getTime() + UNDELIVERED_AFTER_MS)), false);
  assert.equal(refundAllowed("undelivered_flagged"), true);
  assert.equal(refundAllowed("paid"), false);
  assert.equal(subaccountCodeOk(" acct_tilapia "), "ACCT_TILAPIA");
  assert.equal(subaccountCodeOk("nope"), null);
  assert.equal(subaccountCodeOk("  "), "");
  const choices = deliveryChoices([
    { id: "z1", kind: "zone", label: "Kisumu CBD", feeKes: 200, active: true },
    { id: "off", kind: "flat", label: "Hidden", feeKes: 50, active: false },
  ]);
  assert.deepEqual(
    choices.map((choice) => choice.id),
    ["pickup", "z1"],
  );
});

test("Paystack calls use the injected fetch and do not touch the network", async () => {
  const calls: { url: string; body: string }[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, body: String(init?.body ?? "") });
    return {
      ok: true,
      json: async () =>
        url.endsWith("/refund")
          ? { status: true }
          : { status: true, data: { authorization_url: "https://paystack.test/pay/po_abc" } },
    };
  };
  const started = await initialiseTransaction(
    paystackInitializeRequest({
      secret,
      email: "akinyi@example.com",
      amountSubunit: 170_000,
      reference: "po_abc",
      subaccount: "ACCT_TILAPIA",
      percent: 4,
      callbackUrl: "https://www.rangach.co.ke/orders/po_abc",
    }),
    fetchImpl,
  );
  const refunded = await refundTransaction({ secret, reference: "po_abc" }, fetchImpl);
  assert.equal(started.ok, true);
  if (started.ok) assert.equal(started.url, "https://paystack.test/pay/po_abc");
  assert.equal(refunded.ok, true);
  assert.deepEqual(
    calls.map((call) => call.url),
    ["https://api.paystack.co/transaction/initialize", "https://api.paystack.co/refund"],
  );
  assert.match(calls[0]?.body ?? "", /"subaccount":"ACCT_TILAPIA"/);
  assert.match(calls[0]?.body ?? "", /"percentage_charge":4/);
  assert.match(calls[1]?.body ?? "", /"transaction":"po_abc"/);
});

test("collect-code attempts are limited on a hash of the order id", async () => {
  const memory = new Map();
  const first = await limitOrderCollect("ord_secret", { memory, durable: null, now: 1_700_000_000_000 });
  assert.equal(first, false);
  let last = false;
  for (let i = 0; i < 8; i += 1) {
    last = await limitOrderCollect("ord_secret", { memory, durable: null, now: 1_700_000_000_000 });
  }
  assert.equal(last, true);
  const key = [...memory.keys()][0] ?? "";
  assert.equal(key.includes("ord_secret"), false);
  assert.match(key, /^order_collect:/);
});

test("pages stay behind the flag and never say escrow or that Rangach holds the money", () => {
  const files = [
    "../components/protected-order-form.tsx",
    "../components/protected-order-panel.tsx",
    "../app/b/[slug]/page.tsx",
    "../app/orders/[reference]/page.tsx",
    "../app/account/orders/page.tsx",
    "../app/admin/orders/page.tsx",
    "../app/admin/page.tsx",
    "../app/admin/layout.tsx",
    "../app/account/page.tsx",
    "../app/privacy/page.tsx",
    "protected-order.ts",
    "actions/protected-order.ts",
    "paystack.ts",
    "../app/api/paystack/webhook/route.ts",
  ];
  const joined = files.map((file) => readFileSync(new URL(file, import.meta.url), "utf8")).join("\n");
  assert.equal(/escrow/i.test(joined), false);
  assert.equal(/rangach holds/i.test(joined), false);
  assert.equal(/funeral/i.test(joined), false);
  assert.match(joined, /fresh tilapia/i);
  assert.match(PROTECTED_ORDER_COPY, /Paystack pays the shop directly/);
  assert.match(PROTECTED_ORDER_COPY, /does not hold the money/);
  assert.equal(/escrow/i.test(ORDER_STATUS_LABEL.paid), false);

  const shop = readFileSync(new URL("../app/b/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(shop, /protectedOrdersOn\(\)/);
  assert.match(shop, /ProtectedOrderPanel/);
  const admin = readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(admin, /ordersOn: protectedOrdersOn\(\)/);
  const account = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  assert.match(account, /protectedOrdersOn\(\) \?/);
  for (const page of ["../app/orders/[reference]/page.tsx", "../app/account/orders/page.tsx", "../app/admin/orders/page.tsx"]) {
    const source = readFileSync(new URL(page, import.meta.url), "utf8");
    assert.match(source, /if \(!protectedOrdersOn\(\)\) notFound\(\)/);
  }
  const seller = readFileSync(new URL("../app/account/orders/page.tsx", import.meta.url), "utf8");
  assert.equal(seller.includes("collectCode"), false);
  const adminOrders = readFileSync(new URL("../app/admin/orders/page.tsx", import.meta.url), "utf8");
  assert.equal(adminOrders.includes("collectCode"), false);
  assert.match(adminOrders, /flagStaleProtectedOrders/);
  assert.match(adminOrders, /confirmRefund/);

  const webhook = readFileSync(new URL("../app/api/paystack/webhook/route.ts", import.meta.url), "utf8");
  assert.match(webhook, /paystackSignatureOk/);
  assert.match(webhook, /P2002/);
  assert.match(webhook, /protectedOrdersOn\(\)/);
  const action = readFileSync(new URL("actions/protected-order.ts", import.meta.url), "utf8");
  assert.match(action, /limitOrderCollect/);
  assert.match(action, /initialiseTransaction/);
  assert.match(action, /field\(formData, "confirm"\) !== "refund"/);

  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /paystackSubaccountCode\s+String\?/);
  assert.match(schema, /model Order \{/);
  assert.match(schema, /model OrderItem \{/);
  assert.match(schema, /model OrderEvent \{/);
  assert.match(schema, /model PaystackEvent \{/);
  assert.match(schema, /model ShopDeliveryOption \{/);
  const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
  assert.match(example, /PROTECTED_ORDERS=/);
  assert.match(example, /PAYSTACK_SECRET_KEY=/);
  assert.match(example, /PAYSTACK_PUBLIC_KEY=/);
  assert.match(example, /BRS registration/);
});

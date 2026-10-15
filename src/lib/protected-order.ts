import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "accepted",
  "out_for_delivery",
  "delivered",
  "undelivered_flagged",
  "refund_pending",
  "refunded",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Waiting for Paystack",
  paid: "Paid to the shop",
  accepted: "Shop accepted",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  undelivered_flagged: "Not delivered after 72 hours",
  refund_pending: "Refund in progress",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

export const UNDELIVERED_AFTER_MS = 72 * 60 * 60 * 1000;

export const PROTECTED_ORDER_COPY =
  "Paystack pays the shop directly. Rangach takes a commission on that payment. Rangach does not hold the money.";

const ON = new Set(["1", "true", "yes", "on"]);

/** Off unless PROTECTED_ORDERS is 1, true, yes, or on. */
export function protectedOrdersOn(env: NodeJS.ProcessEnv = process.env) {
  return ON.has((env.PROTECTED_ORDERS ?? "").trim().toLowerCase());
}

/** Rangach's share of a protected order. Defaults to 4. Clamped to 0–100. */
export function commissionPercent(env: NodeJS.ProcessEnv = process.env) {
  const raw = Number((env.PROTECTED_ORDER_COMMISSION_PERCENT ?? "").trim() || "4");
  if (!Number.isFinite(raw)) return 4;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function newCollectCode(random: () => number = () => randomInt(0, 1_000_000)) {
  return String(random()).padStart(6, "0");
}

export function newPaystackReference(random: () => string = () => randomInt(0, 2 ** 31).toString(16)) {
  return `po_${random()}${random()}`;
}

export function paystackSignatureOk(rawBody: string, signature: string, secret: string) {
  if (!secret || !signature) return false;
  const digest = createHmac("sha512", secret).update(rawBody).digest("hex");
  const left = Buffer.from(digest);
  const right = Buffer.from(signature.trim());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type DeliveryChoice = {
  id: string;
  kind: "pickup" | "flat" | "zone";
  label: string;
  feeKes: number;
};

export function deliveryChoices(
  rows: { id: string; kind: string; label: string; feeKes: number; active: boolean }[],
): DeliveryChoice[] {
  const choices: DeliveryChoice[] = [{ id: "pickup", kind: "pickup", label: "Pickup", feeKes: 0 }];
  for (const row of rows) {
    if (!row.active) continue;
    if (row.kind !== "flat" && row.kind !== "zone") continue;
    if (!Number.isInteger(row.feeKes) || row.feeKes < 0 || row.feeKes > 100_000) continue;
    const label = row.label.trim();
    if (label.length < 2) continue;
    choices.push({ id: row.id, kind: row.kind, label, feeKes: row.feeKes });
  }
  return choices;
}

export function deliveryById(choices: DeliveryChoice[], id: string) {
  return choices.find((choice) => choice.id === id) ?? null;
}

export type PaystackInitialize = {
  url: "https://api.paystack.co/transaction/initialize";
  headers: { Authorization: string; "Content-Type": "application/json" };
  body: {
    email: string;
    amount: number;
    currency: "KES";
    reference: string;
    subaccount: string;
    percentage_charge: number;
    bearer: "subaccount";
    callback_url: string;
  };
};

export function paystackInitializeRequest(input: {
  secret: string;
  email: string;
  amountSubunit: number;
  reference: string;
  subaccount: string;
  percent: number;
  callbackUrl: string;
}): PaystackInitialize {
  return {
    url: "https://api.paystack.co/transaction/initialize",
    headers: {
      Authorization: `Bearer ${input.secret}`,
      "Content-Type": "application/json",
    },
    body: {
      email: input.email,
      amount: input.amountSubunit,
      currency: "KES",
      reference: input.reference,
      subaccount: input.subaccount,
      percentage_charge: input.percent,
      bearer: "subaccount",
      callback_url: input.callbackUrl,
    },
  };
}

export function paystackRefundRequest(input: { secret: string; reference: string }) {
  return {
    url: "https://api.paystack.co/refund",
    headers: {
      Authorization: `Bearer ${input.secret}`,
      "Content-Type": "application/json",
    },
    body: { transaction: input.reference },
  };
}

export function subaccountCodeOk(raw: string) {
  const code = raw.trim().toUpperCase();
  if (!code) return "";
  if (!/^ACCT_[A-Z0-9]+$/.test(code)) return null;
  return code;
}

export type ChargeSuccess = {
  eventId: string;
  reference: string;
  amountSubunit: number;
  currency: string;
  status: string;
};

export function readChargeSuccess(payload: unknown): ChargeSuccess | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as { event?: unknown; data?: unknown };
  if (record.event !== "charge.success") return null;
  if (!record.data || typeof record.data !== "object") return null;
  const data = record.data as { id?: unknown; reference?: unknown; amount?: unknown; currency?: unknown; status?: unknown };
  if (typeof data.reference !== "string" || !data.reference) return null;
  if (typeof data.amount !== "number" || !Number.isInteger(data.amount)) return null;
  const id = data.id === undefined || data.id === null ? "" : String(data.id);
  return {
    eventId: `charge.success:${data.reference}:${id}`,
    reference: data.reference,
    amountSubunit: data.amount,
    currency: typeof data.currency === "string" ? data.currency : "",
    status: typeof data.status === "string" ? data.status : "",
  };
}

export type OrderSnapshot = {
  id: string;
  status: string;
  paystackReference: string;
  itemsSubunit: number;
  deliverySubunit: number;
  collectCode: string;
  paidAt: Date | null;
};

export function orderAmountSubunit(order: { itemsSubunit: number; deliverySubunit: number }) {
  return order.itemsSubunit + order.deliverySubunit;
}

export function quoteSubunits(items: { qty: number; unitSubunit: number }[], deliveryFeeKes: number) {
  const itemsSubunit = items.reduce((sum, item) => sum + item.qty * item.unitSubunit, 0);
  const deliverySubunit = deliveryFeeKes * 100;
  return { itemsSubunit, deliverySubunit, amountSubunit: itemsSubunit + deliverySubunit };
}

/** Apply a verified charge.success. A repeated event id does nothing. */
export function applyPaid(
  order: OrderSnapshot,
  charge: ChargeSuccess,
  alreadySeen: boolean,
  now: Date,
): { status: OrderStatus; paidAt: Date | null; note: string; changed: boolean } {
  if (alreadySeen) return { status: order.status as OrderStatus, paidAt: order.paidAt, note: "Already recorded.", changed: false };
  if (charge.status !== "success") {
    return { status: order.status as OrderStatus, paidAt: order.paidAt, note: "Payment was not successful.", changed: false };
  }
  if (charge.currency && charge.currency !== "KES") {
    return { status: order.status as OrderStatus, paidAt: order.paidAt, note: "Currency was not KES.", changed: false };
  }
  if (charge.amountSubunit !== orderAmountSubunit(order)) {
    return { status: order.status as OrderStatus, paidAt: order.paidAt, note: "Amount did not match the order.", changed: false };
  }
  if (order.status !== "pending_payment") {
    return { status: order.status as OrderStatus, paidAt: order.paidAt, note: "Order was already past payment.", changed: false };
  }
  return { status: "paid", paidAt: now, note: "Paystack confirmed payment to the shop.", changed: true };
}

const DELIVERABLE = new Set(["paid", "accepted", "out_for_delivery"]);

export function nextSellerStatus(current: string, action: "accept" | "dispatch"): OrderStatus | null {
  if (action === "accept" && current === "paid") return "accepted";
  if (action === "dispatch" && (current === "paid" || current === "accepted")) return "out_for_delivery";
  return null;
}

export function deliverWithCode(order: OrderSnapshot, entered: string, now: Date) {
  if (!DELIVERABLE.has(order.status)) return { ok: false as const, error: "This order cannot be marked delivered." };
  const code = entered.trim();
  if (!/^\d{6}$/.test(code) || code !== order.collectCode) {
    return { ok: false as const, error: "That code does not match." };
  }
  return { ok: true as const, status: "delivered" as const, deliveredAt: now };
}

export function shouldFlagUndelivered(order: { status: string; paidAt: Date | null }, now: Date) {
  if (!DELIVERABLE.has(order.status)) return false;
  if (!order.paidAt) return false;
  return now.getTime() - order.paidAt.getTime() >= UNDELIVERED_AFTER_MS;
}

export function refundAllowed(status: string) {
  return status === "undelivered_flagged";
}

export function kesLabelFromSubunit(subunit: number) {
  const shillings = subunit / 100;
  const rounded = Number.isInteger(shillings) ? shillings : Math.round(shillings * 100) / 100;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `KES ${text.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

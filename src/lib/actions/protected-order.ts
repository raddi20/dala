"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPlausibleEmail, normalizeEmail } from "@/lib/admin-access";
import { initialiseTransaction, refundTransaction } from "@/lib/paystack";
import { publicOrigin } from "@/lib/payments/origin";
import { parsePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import {
  commissionPercent,
  deliverWithCode,
  deliveryById,
  deliveryChoices,
  newCollectCode,
  newPaystackReference,
  nextSellerStatus,
  paystackInitializeRequest,
  protectedOrdersOn,
  quoteSubunits,
  refundAllowed,
  shouldFlagUndelivered,
  subaccountCodeOk,
} from "@/lib/protected-order";
import { limitOrderCollect } from "@/lib/rate-limit";
import { writeAdminAudit } from "@/lib/moderation";
import { requireAdmin, requireUser } from "@/lib/session";
import { field, type ActionState } from "@/lib/validators";

function cleanName(raw: string) {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < 2 || value.length > 80) return null;
  return value;
}

export async function createProtectedOrder(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (!protectedOrdersOn()) return { error: "Protected orders are switched off." };
  const shop = await prisma.storefront.findUnique({
    where: { slug: field(formData, "slug") },
    include: {
      deliveryOptions: true,
      offerings: { where: { archived: false, hidden: false } },
      user: { select: { suspended: true } },
    },
  });
  if (!shop || !shop.published || shop.hidden || shop.user.suspended) return { error: "That shop is not open." };
  const subaccount = shop.paystackSubaccountCode ?? "";
  if (!subaccount) return { error: "This shop is not ready for a protected order." };
  const secret = (process.env.PAYSTACK_SECRET_KEY ?? "").trim();
  if (!secret) return { error: "Payments are not configured." };

  const items: { title: string; qty: number; unitSubunit: number }[] = [];
  for (const offering of shop.offerings) {
    if (offering.currency !== "KES" || !offering.priceCents || offering.priceCents <= 0) continue;
    const qty = Number(field(formData, `qty_${offering.id}`));
    if (!Number.isInteger(qty) || qty <= 0) continue;
    if (qty > 20) return { error: "Quantity must be 20 or fewer." };
    items.push({ title: offering.title, qty, unitSubunit: offering.priceCents });
  }
  if (items.length === 0) return { error: "Choose at least one item." };

  const delivery = deliveryById(deliveryChoices(shop.deliveryOptions), field(formData, "delivery"));
  if (!delivery) return { error: "Choose pickup or a delivery price." };
  const name = cleanName(field(formData, "buyerName"));
  if (!name) return { error: "Enter your name." };
  const email = normalizeEmail(field(formData, "buyerEmail"));
  if (!isPlausibleEmail(email)) return { error: "Enter an email address." };
  const phone = parsePhone(field(formData, "buyerPhone"), "KE");
  if (!phone.ok) return { error: phone.error, field: "buyerPhone" };
  const quote = quoteSubunits(items, delivery.feeKes);
  if (quote.amountSubunit <= 0) return { error: "The total must be more than zero." };

  const reference = newPaystackReference();
  const percent = commissionPercent();
  const order = await prisma.order.create({
    data: {
      storefrontId: shop.id,
      buyerName: name,
      buyerEmail: email,
      buyerPhone: phone.e164,
      itemsSubunit: quote.itemsSubunit,
      deliverySubunit: quote.deliverySubunit,
      deliveryKind: delivery.kind,
      deliveryLabel: delivery.label,
      commissionPercent: percent,
      paystackReference: reference,
      subaccountCode: subaccount,
      collectCode: newCollectCode(),
      items: { create: items },
      events: { create: { status: "pending_payment", note: "Buyer asked Paystack to pay the shop." } },
    },
  });

  const origin = await publicOrigin();
  const started = await initialiseTransaction(
    paystackInitializeRequest({
      secret,
      email,
      amountSubunit: quote.amountSubunit,
      reference,
      subaccount,
      percent,
      callbackUrl: `${origin}/orders/${reference}`,
    }),
    fetch,
  );
  if (!started.ok) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
    await prisma.orderEvent.create({
      data: { orderId: order.id, status: "cancelled", note: started.message },
    });
    return { error: started.message };
  }
  redirect(started.url);
}

export async function updateSellerOrder(formData: FormData) {
  if (!protectedOrdersOn()) redirect("/");
  const user = await requireUser("/account/orders");
  const id = field(formData, "id");
  const action = field(formData, "action");
  const order = await prisma.order.findUnique({
    where: { id },
    include: { storefront: { select: { userId: true, slug: true } } },
  });
  if (!order || order.storefront.userId !== user.id) redirect("/account/orders?notice=missing");

  if (action === "deliver") {
    if (await limitOrderCollect(order.id)) redirect("/account/orders?notice=limited");
    const result = deliverWithCode(order, field(formData, "code"), new Date());
    if (!result.ok) redirect("/account/orders?notice=code");
    await prisma.order.update({
      where: { id: order.id },
      data: { status: result.status, deliveredAt: result.deliveredAt },
    });
    await prisma.orderEvent.create({
      data: { orderId: order.id, status: result.status, note: "Shop entered the collect code." },
    });
  } else if (action === "accept" || action === "dispatch") {
    const status = nextSellerStatus(order.status, action);
    if (!status) redirect("/account/orders?notice=status");
    await prisma.order.update({ where: { id: order.id }, data: { status } });
    await prisma.orderEvent.create({
      data: { orderId: order.id, status, note: action === "accept" ? "Shop accepted the order." : "Out for delivery." },
    });
  }
  revalidatePath("/account/orders");
  revalidatePath(`/orders/${order.paystackReference}`);
  redirect("/account/orders?notice=saved");
}

export async function saveSubaccount(formData: FormData) {
  const admin = await requireAdmin("/admin/orders");
  if (!protectedOrdersOn()) redirect("/");
  const id = field(formData, "id");
  const code = subaccountCodeOk(field(formData, "subaccount"));
  if (code === null) redirect("/admin/orders?notice=subaccount");
  const shop = await prisma.storefront.findUnique({ where: { id }, select: { id: true, slug: true } });
  if (!shop) redirect("/admin/orders?notice=missing");
  await prisma.storefront.update({ where: { id }, data: { paystackSubaccountCode: code || null } });
  await writeAdminAudit({
    actor: admin,
    action: "order.subaccount",
    targetType: "storefront",
    targetId: id,
    reason: code ? `Subaccount ${code}` : "Cleared the subaccount code.",
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/b/${shop.slug}`);
  redirect("/admin/orders?notice=saved");
}

export async function addDeliveryOption(formData: FormData) {
  const admin = await requireAdmin("/admin/orders");
  if (!protectedOrdersOn()) redirect("/");
  const storefrontId = field(formData, "id");
  const kind = field(formData, "kind");
  const label = field(formData, "label").trim().replace(/\s+/g, " ");
  const feeKes = Number(field(formData, "feeKes"));
  if (kind !== "flat" && kind !== "zone") redirect("/admin/orders?notice=delivery");
  if (label.length < 2 || label.length > 60) redirect("/admin/orders?notice=delivery");
  if (!Number.isInteger(feeKes) || feeKes < 0 || feeKes > 100_000) redirect("/admin/orders?notice=delivery");
  const shop = await prisma.storefront.findUnique({ where: { id: storefrontId }, select: { id: true } });
  if (!shop) redirect("/admin/orders?notice=missing");
  const row = await prisma.shopDeliveryOption.create({
    data: { storefrontId, kind, label, feeKes },
  });
  await writeAdminAudit({
    actor: admin,
    action: "order.delivery",
    targetType: "storefront",
    targetId: storefrontId,
    reason: `${kind} ${label} KES ${feeKes} (${row.id})`,
  });
  revalidatePath("/admin/orders");
  redirect("/admin/orders?notice=saved");
}

export async function confirmRefund(formData: FormData) {
  const admin = await requireAdmin("/admin/orders");
  if (!protectedOrdersOn()) redirect("/");
  if (field(formData, "confirm") !== "refund") redirect("/admin/orders?notice=confirm");
  const id = field(formData, "id");
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) redirect("/admin/orders?notice=missing");
  if (!refundAllowed(order.status)) redirect("/admin/orders?notice=refund");
  const secret = (process.env.PAYSTACK_SECRET_KEY ?? "").trim();
  if (!secret) redirect("/admin/orders?notice=config");
  await prisma.order.update({ where: { id }, data: { status: "refund_pending" } });
  const result = await refundTransaction({ secret, reference: order.paystackReference }, fetch);
  if (!result.ok) {
    await prisma.orderEvent.create({
      data: { orderId: id, status: "refund_pending", note: result.message },
    });
    redirect("/admin/orders?notice=refund-failed");
  }
  await prisma.order.update({ where: { id }, data: { status: "refunded", refundedAt: new Date() } });
  await prisma.orderEvent.create({
    data: { orderId: id, status: "refunded", note: "Admin confirmed a Paystack refund to the buyer." },
  });
  await writeAdminAudit({
    actor: admin,
    action: "order.refund",
    targetType: "order",
    targetId: id,
    reason: `Paystack refund for ${order.paystackReference}`,
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/orders/${order.paystackReference}`);
  redirect("/admin/orders?notice=saved");
}

export async function flagStaleProtectedOrders(now = new Date()) {
  if (!protectedOrdersOn()) return 0;
  const rows = await prisma.order.findMany({
    where: { status: { in: ["paid", "accepted", "out_for_delivery"] }, paidAt: { not: null } },
  });
  let flagged = 0;
  for (const order of rows) {
    if (!shouldFlagUndelivered(order, now)) continue;
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "undelivered_flagged", flaggedAt: now },
    });
    await prisma.orderEvent.create({
      data: { orderId: order.id, status: "undelivered_flagged", note: "No delivery within 72 hours." },
    });
    flagged += 1;
  }
  return flagged;
}

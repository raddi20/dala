import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addDeliveryOption,
  confirmRefund,
  flagStaleProtectedOrders,
  saveSubaccount,
} from "@/lib/actions/protected-order";
import { Flash, btnDanger, btnPrimary, btnSecondary, cardClass, fieldClass, labelClass } from "@/components/ui";
import { AUDIENCE_LINE } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import {
  ORDER_STATUS_LABEL,
  PROTECTED_ORDER_COPY,
  isOrderStatus,
  kesLabelFromSubunit,
  protectedOrdersOn,
} from "@/lib/protected-order";
import { privateMetadata } from "@/lib/share-metadata";
import { requireAdmin } from "@/lib/session";
import { formatWhen, one } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  saved: "Saved.",
  missing: "That shop or order was not found.",
  subaccount: "Enter a Paystack subaccount such as ACCT_ followed by letters and numbers, or leave it blank to clear it.",
  delivery: "Enter a flat or zone price with a short label.",
  confirm: "Type refund to confirm.",
  refund: "Only an order flagged after 72 hours can be refunded.",
  config: "PAYSTACK_SECRET_KEY is not set.",
  "refund-failed": "Paystack did not queue the refund. The order stays as refund in progress.",
};

export async function generateMetadata(): Promise<Metadata> {
  if (!protectedOrdersOn()) return privateMetadata("Page");
  return privateMetadata("Protected orders");
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!protectedOrdersOn()) notFound();
  await requireAdmin("/admin/orders");
  const flagged = await flagStaleProtectedOrders();
  const notice = NOTICES[one((await searchParams).notice)] ?? "";
  const [shops, orders] = await Promise.all([
    prisma.storefront.findMany({
      orderBy: { user: { name: "asc" } },
      take: 80,
      select: {
        id: true,
        slug: true,
        paystackSubaccountCode: true,
        user: { select: { name: true } },
        deliveryOptions: {
          orderBy: { createdAt: "asc" },
          select: { id: true, kind: true, label: true, feeKes: true, active: true },
        },
      },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        status: true,
        buyerName: true,
        itemsSubunit: true,
        deliverySubunit: true,
        deliveryLabel: true,
        paystackReference: true,
        commissionPercent: true,
        createdAt: true,
        storefront: { select: { slug: true, user: { select: { name: true } } } },
      },
    }),
  ]);

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">{AUDIENCE_LINE}</p>
        <h1 className="mt-2 font-serif text-3xl text-navy">Protected orders</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          {PROTECTED_ORDER_COPY} Enter each shop’s Paystack subaccount and any flat or zone delivery price. Pickup stays
          free. Do not take live money until BRS registration, a Paystack account, and a lawyer check are done.
        </p>
        {flagged > 0 ? (
          <p className="mt-2 text-sm font-semibold text-navy">{flagged} order{flagged === 1 ? "" : "s"} flagged after 72 hours.</p>
        ) : null}
      </div>
      {notice ? <Flash>{notice}</Flash> : null}

      <section className="grid gap-4">
        <h2 className="font-serif text-2xl text-navy">Shops</h2>
        <ul className="grid gap-4">
          {shops.map((shop) => (
            <li key={shop.id} className={`${cardClass} grid gap-3 p-5`}>
              <p className="font-semibold text-navy">
                <Link href={`/b/${shop.slug}`} className="underline">
                  {shop.user.name}
                </Link>
              </p>
              <form action={saveSubaccount} className="grid gap-2">
                <input type="hidden" name="id" value={shop.id} />
                <label className={labelClass}>
                  Paystack subaccount
                  <input
                    name="subaccount"
                    defaultValue={shop.paystackSubaccountCode ?? ""}
                    placeholder="ACCT_"
                    className={fieldClass}
                    autoComplete="off"
                  />
                </label>
                <button type="submit" className={btnSecondary}>
                  Save subaccount
                </button>
              </form>
              {shop.deliveryOptions.length > 0 ? (
                <ul className="text-sm text-ink/70">
                  {shop.deliveryOptions.map((option) => (
                    <li key={option.id}>
                      {option.kind}: {option.label} · KES {option.feeKes}
                      {option.active ? "" : " · off"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink/60">Pickup only.</p>
              )}
              <form action={addDeliveryOption} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="id" value={shop.id} />
                <label className={labelClass}>
                  Kind
                  <select name="kind" className={fieldClass} defaultValue="flat">
                    <option value="flat">Flat fee</option>
                    <option value="zone">Zone</option>
                  </select>
                </label>
                <label className={labelClass}>
                  Fee (KES)
                  <input name="feeKes" type="number" min={0} max={100000} defaultValue={0} className={fieldClass} />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Label
                  <input name="label" required minLength={2} maxLength={60} placeholder="Kisumu CBD" className={fieldClass} />
                </label>
                <button type="submit" className={`${btnSecondary} sm:col-span-2`}>
                  Add delivery price
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4">
        <h2 className="font-serif text-2xl text-navy">Orders</h2>
        {orders.length === 0 ? <p className="text-sm text-ink/70">No protected orders yet.</p> : null}
        <ul className="grid gap-4">
          {orders.map((order) => {
            const status = isOrderStatus(order.status) ? ORDER_STATUS_LABEL[order.status] : order.status;
            return (
              <li key={order.id} className={`${cardClass} grid gap-2 p-5 text-sm`}>
                <p className="font-semibold text-navy">
                  {order.buyerName}
                  <span className="font-normal text-ink/60"> · {order.storefront.user.name}</span>
                </p>
                <p>
                  {status}
                  <span className="text-ink/40"> · </span>
                  {formatWhen(order.createdAt)}
                  <span className="text-ink/40"> · </span>
                  {kesLabelFromSubunit(order.itemsSubunit + order.deliverySubunit)}
                  <span className="text-ink/40"> · </span>
                  {order.commissionPercent}% commission
                </p>
                <p className="text-ink/70">{order.deliveryLabel || "Pickup"}</p>
                <p className="break-all text-ink/60">{order.paystackReference}</p>
                {order.status === "undelivered_flagged" ? (
                  <form action={confirmRefund} className="mt-2 grid gap-2">
                    <input type="hidden" name="id" value={order.id} />
                    <label className={labelClass}>
                      Type refund to ask Paystack to refund the buyer
                      <input name="confirm" className={fieldClass} autoComplete="off" />
                    </label>
                    <button type="submit" className={btnDanger}>
                      Refund
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-sm">
        <Link href="/admin" className={`${btnPrimary} no-underline`}>
          Back to admin
        </Link>
      </p>
    </div>
  );
}

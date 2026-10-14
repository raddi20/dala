import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash, btnPrimary, btnSecondary, cardClass, fieldClass, labelClass } from "@/components/ui";
import { updateSellerOrder } from "@/lib/actions/protected-order";
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
import { requireUser } from "@/lib/session";
import { formatWhen, one } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, string> = {
  saved: "Saved.",
  missing: "That order is not on this shop.",
  limited: "Too many code attempts. Wait 15 minutes.",
  code: "That code does not match.",
  status: "That step is not available for this order.",
};

export async function generateMetadata(): Promise<Metadata> {
  if (!protectedOrdersOn()) return privateMetadata("Page");
  return privateMetadata("Orders");
}

export default async function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!protectedOrdersOn()) notFound();
  const user = await requireUser("/account/orders");
  const shop = await prisma.storefront.findUnique({
    where: { userId: user.id },
    select: { id: true, slug: true },
  });
  const notice = NOTICES[one((await searchParams).notice)] ?? "";
  const orders = shop
    ? await prisma.order.findMany({
        where: { storefrontId: shop.id },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          status: true,
          buyerName: true,
          itemsSubunit: true,
          deliverySubunit: true,
          deliveryLabel: true,
          createdAt: true,
          items: { select: { id: true, title: true, qty: true } },
        },
      })
    : [];

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">{AUDIENCE_LINE}</p>
        <h1 className="mt-2 font-serif text-3xl text-navy">Protected orders</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          Accept an order, send it out, then enter the buyer’s 6-digit collect code to mark it delivered. The code
          stays with the buyer. {PROTECTED_ORDER_COPY}
        </p>
      </div>
      {notice ? <Flash>{notice}</Flash> : null}
      {!shop ? (
        <p className="text-sm text-ink/70">
          You do not have a shop yet.{" "}
          <Link href="/account" className="font-semibold text-lake-dark underline">
            Open your account
          </Link>
          .
        </p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-ink/70">No protected orders yet.</p>
      ) : (
        <ul className="grid gap-4">
          {orders.map((order) => {
            const status = isOrderStatus(order.status) ? ORDER_STATUS_LABEL[order.status] : order.status;
            const open = order.status === "paid" || order.status === "accepted" || order.status === "out_for_delivery";
            return (
              <li key={order.id} className={`${cardClass} grid gap-3 p-5`}>
                <div>
                  <p className="font-semibold text-navy">{order.buyerName}</p>
                  <p className="text-sm text-ink/70">
                    {status}
                    <span className="text-ink/40"> · </span>
                    {formatWhen(order.createdAt)}
                    <span className="text-ink/40"> · </span>
                    {kesLabelFromSubunit(order.itemsSubunit + order.deliverySubunit)}
                  </p>
                  <p className="mt-1 text-sm text-ink/70">{order.deliveryLabel || "Pickup"}</p>
                  <ul className="mt-2 text-sm">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.qty} × {item.title}
                      </li>
                    ))}
                  </ul>
                </div>
                {order.status === "paid" ? (
                  <form action={updateSellerOrder}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="action" value="accept" />
                    <button type="submit" className={btnSecondary}>
                      Accept
                    </button>
                  </form>
                ) : null}
                {order.status === "paid" || order.status === "accepted" ? (
                  <form action={updateSellerOrder}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="action" value="dispatch" />
                    <button type="submit" className={btnSecondary}>
                      Out for delivery
                    </button>
                  </form>
                ) : null}
                {open ? (
                  <form action={updateSellerOrder} className="grid gap-2">
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="action" value="deliver" />
                    <label className={labelClass}>
                      Collect code
                      <input
                        name="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        minLength={6}
                        maxLength={6}
                        required
                        className={fieldClass}
                        aria-label={`Collect code for ${order.buyerName}`}
                      />
                    </label>
                    <button type="submit" className={btnPrimary}>
                      Mark delivered
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

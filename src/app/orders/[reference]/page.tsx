import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cardClass } from "@/components/ui";
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
import { formatWhen } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SHOW_CODE = new Set([
  "paid",
  "accepted",
  "out_for_delivery",
  "delivered",
  "undelivered_flagged",
  "refund_pending",
  "refunded",
]);

export async function generateMetadata(): Promise<Metadata> {
  if (!protectedOrdersOn()) return privateMetadata("Page");
  return privateMetadata("Order");
}

export default async function BuyerOrderPage({ params }: { params: Promise<{ reference: string }> }) {
  if (!protectedOrdersOn()) notFound();
  const { reference } = await params;
  const order = await prisma.order.findUnique({
    where: { paystackReference: reference },
    include: {
      items: { orderBy: { id: "asc" } },
      storefront: { select: { slug: true, user: { select: { name: true } } } },
    },
  });
  if (!order) notFound();
  const status = isOrderStatus(order.status) ? ORDER_STATUS_LABEL[order.status] : order.status;
  const total = order.itemsSubunit + order.deliverySubunit;

  return (
    <div className="mx-auto grid max-w-lg gap-6 px-4 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">{AUDIENCE_LINE}</p>
        <h1 className="mt-2 font-serif text-3xl text-navy">Your order</h1>
        <p className="mt-2 text-sm text-ink/70">
          <Link href={`/b/${order.storefront.slug}`} className="font-semibold text-lake-dark underline">
            {order.storefront.user.name}
          </Link>
          <span className="text-ink/40"> · </span>
          {formatWhen(order.createdAt)}
        </p>
      </div>
      <section className={`${cardClass} grid gap-3 p-5`}>
        <p className="text-sm font-semibold text-navy">{status}</p>
        <ul className="grid gap-1 text-sm">
          {order.items.map((item) => (
            <li key={item.id}>
              {item.qty} × {item.title}
              <span className="text-ink/60"> · {kesLabelFromSubunit(item.unitSubunit)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-ink/70">
          {order.deliveryLabel || "Pickup"} · {kesLabelFromSubunit(order.deliverySubunit)}
        </p>
        <p className="text-sm font-semibold text-navy">Total {kesLabelFromSubunit(total)}</p>
        {SHOW_CODE.has(order.status) ? (
          <div>
            <p className="text-sm text-ink/70">Give this collect code to the shop or the rider.</p>
            <p className="mt-1 font-serif text-4xl tracking-[0.3em] text-navy">{order.collectCode}</p>
          </div>
        ) : (
          <p className="text-sm text-ink/70">The collect code appears here after Paystack confirms the payment.</p>
        )}
        <p className="text-sm leading-relaxed text-ink/70">{PROTECTED_ORDER_COPY}</p>
      </section>
    </div>
  );
}

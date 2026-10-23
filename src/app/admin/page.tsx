import type { Metadata } from "next";
import Link from "next/link";
import { adminTiles } from "@/lib/admin-sections";
import { MODERATION_NOTICES } from "@/lib/moderation";
import { PRO_DAYS } from "@/lib/constants";
import { PAID_UPGRADES_COMING_SOON, paymentsLive } from "@/lib/payments/live";
import { protectedOrdersOn } from "@/lib/protected-order";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

const BADGE = { red: "bg-danger text-white", amber: "bg-amber-soft text-gold-d", none: "bg-paper text-ink/50" } as const;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const moderationCode = one(params.moderation);
  const moderationNotice = MODERATION_NOTICES[moderationCode] ?? "";
  const [openReports, pendingReviews, pendingShopChecks, riskyListings] = await Promise.all([
    prisma.report.count({ where: { status: "open" } }),
    prisma.shopReview.count({ where: { status: "pending" } }),
    // A published shop with no phone, location or business check yet.
    prisma.storefront.count({
      where: { published: true, hidden: false, phoneVerified: false, locationVerified: false, businessVerified: false },
    }),
    prisma.listing.count({ where: { hidden: false, scamRisk: "high" } }),
  ]);
  const tiles = adminTiles(
    { openReports, pendingReviews, pendingShopChecks, riskyListings },
    { ordersOn: protectedOrdersOn() },
  );

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Moderation</h1>
        {moderationNotice ? <p className="mt-3 text-sm font-semibold text-danger">{moderationNotice}</p> : null}
        {paymentsLive() ? null : (
          <p className="mt-2 text-sm font-semibold text-navy">
            {PAID_UPGRADES_COMING_SOON}. Grant, Add {PRO_DAYS} days, and Remove under People still work.
          </p>
        )}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-admin-tiles>
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link
              href={tile.href}
              className="flex h-full items-start justify-between gap-3 rounded-2xl border border-sand bg-card p-4 hover:border-navy/40"
              data-admin-tile={tile.href}
            >
              <span>
                <span className="block font-semibold">{tile.label}</span>
                <span className="mt-1 block text-sm text-ink/70">{tile.blurb}</span>
              </span>
              {tile.count ? (
                <span
                  className={`inline-flex min-w-8 shrink-0 justify-center rounded-full px-2 py-0.5 text-sm font-bold ${BADGE[tile.tone]}`}
                  data-badge-tone={tile.tone}
                  aria-label={`${tile.badge} waiting`}
                >
                  {tile.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-sm text-ink/70">
        Hide listings, shops, offerings, and reviews, and suspend an account. Nothing here is deleted. A suspended
        account cannot sign in, and their shops and listings stay off public pages until you unsuspend them. Shop
        checks (phone, location, business) are granted under Shop checks. Pro plan is paid on Promote for {PRO_DAYS} days and does
        not verify a shop. Granting it here adds {PRO_DAYS} days. Featured is a directory boost. The listing verified
        flag is separate from those checks. Each action is written to the audit log.
      </p>
    </div>
  );
}

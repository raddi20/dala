import type { Metadata } from "next";
import { PayForm } from "@/components/pay-form";
import { FEATURED_DAYS, PRICES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Promote" };

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/upgrade");
  const sp = await searchParams;
  const listings = await prisma.listing.findMany({
    where: { ownerId: user.id },
    select: { id: true, title: true, city: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Promote</h1>
        <p className="mt-2 text-sm text-ink/70">
          Featured listings stay raised for {FEATURED_DAYS} days ({PRICES.featured.Nairobi} / {PRICES.featured.London}). Verified Pro is a paid badge ({PRICES.verified_pro.Nairobi} / {PRICES.verified_pro.London}). The green Verified badge is still granted by an admin.
        </p>
      </div>
      <PayForm listings={listings} defaultListingId={one(sp.listing)} />
    </div>
  );
}

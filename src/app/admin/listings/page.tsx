import type { Metadata } from "next";
import Link from "next/link";
import { AdminContactDetails } from "@/components/admin-contact-details";
import { AdminOccasions } from "@/components/admin-occasions";
import { ListingPhotoReframe } from "@/components/listing-photo-reframe";
import { ReasonInput } from "@/components/admin-reason";
import { btnDanger, btnSecondary } from "@/components/ui";
import { setListingFeatured, setListingHidden, setListingVerified } from "@/lib/actions/admin";
import { listingContactHref } from "@/lib/admin-contact";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Listings" };

export default async function AdminListingsPage() {
  await requireAdmin("/admin/listings");
  const listings = await prisma.listing.findMany({
    include: { owner: { select: { id: true, name: true, email: true, phone: true, whatsapp: true } } },
    orderBy: { createdAt: "desc" },
  });
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const ordered = [...listings].sort((a, b) => (rank[a.scamRisk] ?? 3) - (rank[b.scamRisk] ?? 3));

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Listings</h2>
        <p className="text-sm text-ink/70">This verified flag marks the directory listing. It is separate from shop checks.</p>
        {ordered.map((listing) => (
          <article key={listing.id} className="rounded-2xl border border-sand bg-card p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/listings/${listing.id}`} className="font-semibold">
                {listing.title}
              </Link>
              <span className="text-ink/60">{listing.hidden ? "Hidden" : "Visible"}</span>
            </div>
            <p className="text-ink/70">
              {listing.city} · {listing.type} · {listing.owner.name} · risk {listing.scamRisk}
              {listing.verified ? " · verified" : ""}
            </p>
            <ListingPhotoReframe listingId={listing.id} photoUrl={listing.photoUrl} />
            {listing.scamNotes ? <p className="mt-1">{listing.scamNotes}</p> : null}
            {listing.hiddenReason ? <p className="mt-1 text-ink/70">{listing.hiddenReason}</p> : null}
            <div className="mt-3">
              <AdminContactDetails
                owner={{
                  email: listing.owner.email,
                  phone: listing.owner.phone,
                  whatsapp: listing.owner.whatsapp,
                }}
                listing={{
                  contactName: listing.contactName,
                  contactPhone: listing.contactPhone,
                  contactWhatsapp: listing.contactWhatsapp,
                }}
                editHref={listingContactHref(listing.id)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <form action={setListingHidden} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="hidden" value={listing.hidden ? "0" : "1"} />
                <ReasonInput id={`${listing.id}-hide-reason`} />
                <button className={listing.hidden ? btnSecondary : btnDanger} type="submit">
                  {listing.hidden ? "Unhide" : "Hide"}
                </button>
              </form>
              <form action={setListingVerified}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="verified" value={listing.verified ? "0" : "1"} />
                <button className={btnSecondary}>{listing.verified ? "Remove verified" : "Grant verified"}</button>
              </form>
              <form action={setListingFeatured}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="featured" value={listing.featured ? "0" : "1"} />
                <button className={btnSecondary}>{listing.featured ? "Remove featured" : "Feature for 30 days"}</button>
              </form>
            </div>
          </article>
        ))}
      </section>

      <AdminOccasions />
    </div>
  );
}

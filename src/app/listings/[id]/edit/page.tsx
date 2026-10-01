import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { btnDanger, btnSecondary, cardClass } from "@/components/ui";
import { deleteListing } from "@/lib/actions/listings";
import { setListingOccasions } from "@/lib/actions/occasions";
import { ensureOccasionDefinitions } from "@/lib/occasions";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/listings/${id}/edit`);

  await ensureOccasionDefinitions(prisma);
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: { occasions: { select: { occasion: { select: { slug: true } } } } },
  });
  if (!listing || (listing.ownerId !== user.id && user.role !== "admin")) notFound();
  const occasions = await prisma.occasion.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  });
  const selected = new Set(listing.occasions.map((row) => row.occasion.slug));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-serif text-3xl">Edit listing</h1>
      {user.id === listing.ownerId ? (
        <p className="mt-2 text-sm text-ink/70">
          Offerings live on your shop page, separate from this listing.{" "}
          <Link href="/account/storefront" className="font-semibold text-lake-dark hover:text-lake">
            Manage storefront
          </Link>
        </p>
      ) : null}
      <div className="mt-6">
        <ListingForm
          mode="edit"
          initial={{
            id: listing.id,
            type: listing.type,
            title: listing.title,
            description: listing.description,
            category: listing.category,
            city: listing.city,
            address: listing.address,
            priceLabel: listing.priceLabel,
            contactName: listing.contactName,
            contactPhone: listing.contactPhone,
            contactWhatsapp: listing.contactWhatsapp,
            photoUrl: listing.photoUrl,
          }}
        />
      </div>
      <section className={`mt-8 ${cardClass} p-5`}>
        <h2 className="font-serif text-xl text-navy">Occasions</h2>
        <p className="mt-1 text-sm text-ink/70">
          Tick the moments this listing is for. It can then show on that occasion page. Buyers still reach you on WhatsApp.
        </p>
        <form action={setListingOccasions} className="mt-4 grid gap-2">
          <input type="hidden" name="listingId" value={listing.id} />
          <input type="hidden" name="occasionsPresent" value="1" />
          {occasions.map((occasion) => (
            <label key={occasion.slug} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="occasion"
                value={occasion.slug}
                defaultChecked={selected.has(occasion.slug)}
                className="mt-1"
              />
              <span>{occasion.title}</span>
            </label>
          ))}
          <button className={`${btnSecondary} mt-2 w-fit`} type="submit">
            Save occasions
          </button>
        </form>
      </section>
      <details className="mt-8 rounded-2xl border border-danger/30 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-danger">Delete listing</summary>
        <p className="mt-2 text-sm text-ink/70">This removes the listing, its reviews, and reports.</p>
        <form action={deleteListing} className="mt-3">
          <input type="hidden" name="id" value={listing.id} />
          <button className={btnDanger}>Delete permanently</button>
        </form>
      </details>
    </div>
  );
}

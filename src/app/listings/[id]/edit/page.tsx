import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { btnDanger } from "@/components/ui";
import { deleteListing } from "@/lib/actions/listings";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/listings/${id}/edit`);

  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || (listing.ownerId !== user.id && user.role !== "admin")) notFound();

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

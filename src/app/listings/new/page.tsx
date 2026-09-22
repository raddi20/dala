import type { Metadata } from "next";
import Link from "next/link";
import { ListingForm } from "@/components/listing-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListingPage() {
  const user = await requireUser("/listings/new");
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-serif text-3xl">Add a listing</h1>
      <p className="mt-2 text-sm text-ink/70">
        Businesses go in the directory. For sale, wanted, housing, and services are classifieds. A new listing is checked for common scam language.
      </p>
      <p className="mt-2 text-sm text-ink/70">
        A shop page is separate: offerings and a WhatsApp button.{" "}
        <Link href="/account/storefront" className="font-semibold text-lake-dark hover:text-lake">
          Open a shop
        </Link>
      </p>
      <div className="mt-6">
        <ListingForm
          mode="create"
          initial={{
            type: "business",
            title: "",
            description: "",
            category: "Food & restaurants",
            city: user.city === "London" ? "London" : "Nairobi",
            address: "",
            priceLabel: "",
            contactName: user.name,
            contactPhone: user.phone,
            contactWhatsapp: user.whatsapp,
            photoUrl: "",
          }}
        />
      </div>
    </div>
  );
}

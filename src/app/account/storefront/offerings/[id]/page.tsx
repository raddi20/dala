import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OfferingForm } from "@/components/offering-form";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { centsToInput } from "@/lib/utils";

export const metadata: Metadata = { title: "Edit offering" };

export default async function EditOfferingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/account/storefront/offerings/${id}`);

  const offering = await prisma.offering.findUnique({
    where: { id },
    include: { storefront: { select: { userId: true } } },
  });
  if (!offering || offering.storefront.userId !== user.id) notFound();

  return (
    <div className="mx-auto grid max-w-2xl gap-4 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Edit offering</h1>
        <Link href="/account/storefront" className="mt-2 inline-block text-sm font-semibold text-lake-dark">
          Back to shop
        </Link>
      </div>
      <OfferingForm
        mode="edit"
        currencyDefault={user.city === "London" ? "GBP" : "KES"}
        offering={{
          id: offering.id,
          title: offering.title,
          description: offering.description,
          price: centsToInput(offering.priceCents),
          currency: offering.currency,
          imageUrl: offering.imageUrl,
        }}
      />
    </div>
  );
}

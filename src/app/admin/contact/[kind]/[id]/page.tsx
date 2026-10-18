import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminContactDetails } from "@/components/admin-contact-details";
import { AdminContactForm } from "@/components/admin-contact-form";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { one } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind } = await params;
  return { title: kind === "user" ? "Edit account contact" : "Edit listing contact" };
}

export default async function AdminContactPage({ params, searchParams }: Props) {
  const { kind, id } = await params;
  await requireAdmin(`/admin/contact/${kind}/${id}`);
  if (kind !== "listing" && kind !== "user") notFound();
  const saved = one((await searchParams).saved) === "1";

  if (kind === "listing") {
    const listing = await prisma.listing.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        city: true,
        contactName: true,
        contactPhone: true,
        contactWhatsapp: true,
        owner: { select: { email: true, phone: true, whatsapp: true, name: true } },
      },
    });
    if (!listing) notFound();
    return (
      <div className="mx-auto grid max-w-xl gap-6 px-4 py-8">
        <div>
          <h1 className="font-serif text-3xl">Edit listing contact</h1>
          <p className="mt-1 text-sm text-ink/70">
            {listing.title} · {listing.city} · {listing.owner.name}. This saves the listing phone and WhatsApp. Account
            numbers stay as they are.
          </p>
          <p className="mt-3 text-sm">
            <Link href="/admin" className="font-semibold text-lake-dark underline">
              Moderation
            </Link>
            <span className="text-ink/40"> · </span>
            <Link href="/admin/phones" className="font-semibold text-lake-dark underline">
              Phone numbers
            </Link>
          </p>
        </div>
        {saved ? (
          <p className="rounded-xl border border-sand bg-card px-3 py-2 text-sm" role="status">
            Numbers saved.
          </p>
        ) : null}
        <AdminContactDetails
          open
          owner={listing.owner}
          listing={{
            contactName: listing.contactName,
            contactPhone: listing.contactPhone,
            contactWhatsapp: listing.contactWhatsapp,
          }}
        />
        <AdminContactForm
          kind="listing"
          id={listing.id}
          phone={listing.contactPhone}
          whatsapp={listing.contactWhatsapp}
          city={listing.city}
          phoneLabel="Listing phone"
          whatsappLabel="Listing WhatsApp"
        />
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, whatsapp: true, city: true },
  });
  if (!user) notFound();
  return (
    <div className="mx-auto grid max-w-xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Edit account contact</h1>
        <p className="mt-1 text-sm text-ink/70">
          {user.name} · {user.city}. This saves the account phone and WhatsApp used by the shop.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin" className="font-semibold text-lake-dark underline">
            Moderation
          </Link>
          <span className="text-ink/40"> · </span>
          <Link href="/admin/phones" className="font-semibold text-lake-dark underline">
            Phone numbers
          </Link>
        </p>
      </div>
      {saved ? (
        <p className="rounded-xl border border-sand bg-card px-3 py-2 text-sm" role="status">
          Numbers saved.
        </p>
      ) : null}
      <AdminContactDetails open owner={{ email: user.email, phone: user.phone, whatsapp: user.whatsapp }} />
      <AdminContactForm
        kind="user"
        id={user.id}
        phone={user.phone}
        whatsapp={user.whatsapp}
        city={user.city}
        phoneLabel="Account phone"
        whatsappLabel="Account WhatsApp"
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingCard } from "@/components/listing-card";
import { ReportForm } from "@/components/report-form";
import { blockUser } from "@/lib/actions/social";
import { regionLabel } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { searchListings } from "@/lib/search";
import { getSessionUser } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const person = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: person?.name ?? "Profile" };
}

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const person = await prisma.user.findUnique({ where: { id } });
  if (!person) notFound();

  const viewer = await getSessionUser();
  const blocked = viewer
    ? await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: person.id } },
      })
    : null;
  const owned = await searchListings({
    ownerId: person.id,
    viewerId: viewer?.id,
    includeHidden: viewer?.id === person.id || viewer?.role === "admin",
  });
  const region = person.city === "London" ? "diaspora" : "homeland";
  const shop = await prisma.storefront.findUnique({
    where: { userId: person.id },
    select: { slug: true, published: true },
  });
  const showShop = Boolean(shop?.published) && !blocked;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <div className="rounded-2xl border border-sand bg-card p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-lake">
          {person.kind === "business" ? "Business" : "Person"} · {person.city} · {regionLabel(region)}
        </p>
        <h1 className="mt-1 font-serif text-4xl">{person.name}</h1>
        {person.verifiedPro ? (
          <p className="mt-2 inline-block rounded-full bg-clay px-2 py-0.5 text-xs font-semibold text-white">Verified Pro</p>
        ) : null}
        {person.bio ? <p className="mt-3 whitespace-pre-wrap">{person.bio}</p> : null}
        <div className="mt-3 text-sm text-ink/70">
          {person.phone ? <p>Phone {person.phone}</p> : null}
          {person.whatsapp ? <p>WhatsApp {person.whatsapp}</p> : null}
        </div>
        {showShop && shop ? (
          <Link href={`/b/${shop.slug}`} className="mt-3 inline-block text-sm font-semibold text-lake-dark">
            Visit storefront
          </Link>
        ) : null}
      </div>

      {blocked ? (
        <p className="rounded-lg bg-sand/70 px-3 py-2 text-sm">You blocked this person, so their listings are hidden from your browse.</p>
      ) : null}

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Listings</h2>
        {owned.length === 0 ? <p className="text-sm text-ink/70">No visible listings.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {owned.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {viewer && viewer.id !== person.id ? (
        <section className="grid gap-3">
          <details className="rounded-2xl border border-sand bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">Report this profile</summary>
            <div className="mt-3">
              <ReportForm targetUserId={person.id} />
            </div>
          </details>
          {!blocked ? (
            <form action={blockUser}>
              <input type="hidden" name="userId" value={person.id} />
              <input type="hidden" name="returnTo" value={`/people/${person.id}`} />
              <button className="text-sm font-semibold text-danger">Block this person</button>
            </form>
          ) : (
            <Link href="/account" className="text-sm font-semibold text-lake-dark">
              Manage blocks
            </Link>
          )}
        </section>
      ) : null}
    </div>
  );
}

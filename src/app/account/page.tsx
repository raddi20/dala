import type { Metadata } from "next";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { Flash } from "@/components/ui";
import { btnSecondary } from "@/components/ui";
import { unblockUser } from "@/lib/actions/social";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatWhen, one } from "@/lib/utils";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser("/account");
  const listings = await prisma.listing.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const payments = await prisma.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: { title: true } } },
  });
  const blocks = await prisma.block.findMany({
    where: { blockerId: user.id },
    include: { blocked: { select: { id: true, name: true } } },
  });

  const flash =
    one(sp.saved) === "1"
      ? "Profile saved."
      : one(sp.paid) === "1"
        ? "Payment simulated. Nothing was charged."
        : one(sp.deleted) === "1"
          ? "Listing deleted."
          : "";

  return (
    <div className="mx-auto grid max-w-2xl gap-8 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Account</h1>
        <p className="mt-1 text-sm text-ink/70">
          {user.kind === "business" ? "Business" : "Person"} profile
          {user.verifiedPro ? " · Verified Pro" : ""}
          {user.role === "admin" ? " · Admin" : ""}
        </p>
        <Link href={`/people/${user.id}`} className="mt-2 inline-block text-sm font-semibold text-lake-dark">
          View public profile
        </Link>
      </div>
      {flash ? <Flash>{flash}</Flash> : null}
      <ProfileForm
        user={{
          name: user.name,
          kind: user.kind,
          city: user.city,
          bio: user.bio,
          phone: user.phone,
          whatsapp: user.whatsapp,
          avatarUrl: user.avatarUrl,
          email: user.email,
        }}
      />

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">Your listings</h2>
          <Link href="/listings/new" className={btnSecondary}>
            Add
          </Link>
        </div>
        {listings.length === 0 ? <p className="text-sm text-ink/70">You have not posted yet.</p> : null}
        <ul className="grid gap-2">
          {listings.map((listing) => (
            <li key={listing.id} className="rounded-xl border border-sand bg-card p-3 text-sm">
              <Link href={`/listings/${listing.id}`} className="font-semibold">
                {listing.title}
              </Link>
              <p className="text-ink/70">
                {listing.city} · {listing.hidden ? "Hidden" : "Visible"}
                {listing.scamRisk !== "low" ? ` · ${listing.scamRisk} scam risk` : ""}
              </p>
              <Link href={`/listings/${listing.id}/edit`} className="text-lake-dark">
                Edit
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/upgrade" className="text-sm font-semibold text-lake-dark">
          Feature a listing or get Verified Pro
        </Link>
      </section>

      <section className="grid gap-2">
        <h2 className="font-serif text-2xl">Receipts</h2>
        {payments.length === 0 ? <p className="text-sm text-ink/70">No simulated payments yet.</p> : null}
        <ul className="grid gap-2">
          {payments.map((payment) => (
            <li key={payment.id} className="rounded-xl border border-sand bg-card p-3 text-sm">
              <p className="font-semibold">
                {payment.product === "featured" ? "Featured listing" : "Verified Pro"} · {payment.amount}
              </p>
              <p className="text-ink/70">
                {payment.method === "mpesa" ? "M-Pesa" : "Card"} · {payment.reference}
                {payment.listing ? ` · ${payment.listing.title}` : ""}
              </p>
              <p className="text-ink/60">{payment.note}</p>
              <p className="text-xs text-ink/50">{formatWhen(payment.createdAt)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="font-serif text-2xl">Blocked people</h2>
        {blocks.length === 0 ? <p className="text-sm text-ink/70">You have not blocked anyone.</p> : null}
        <ul className="grid gap-2">
          {blocks.map((block) => (
            <li key={block.id} className="flex items-center justify-between gap-3 rounded-xl border border-sand bg-card p-3 text-sm">
              <Link href={`/people/${block.blocked.id}`} className="font-semibold">
                {block.blocked.name}
              </Link>
              <form action={unblockUser}>
                <input type="hidden" name="userId" value={block.blocked.id} />
                <button className="font-semibold text-lake-dark">Unblock</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

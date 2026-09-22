import type { Metadata } from "next";
import Link from "next/link";
import { PaymentSetup } from "@/components/payment-setup";
import { ProfileForm } from "@/components/profile-form";
import { SellerSteps } from "@/components/seller-steps";
import { Flash, btnPrimary, btnSecondary, cardClass } from "@/components/ui";
import { unblockUser } from "@/lib/actions/social";
import { productLabel } from "@/lib/constants";
import { paymentConfig } from "@/lib/payments/config";
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
  const storefront = await prisma.storefront.findUnique({
    where: { userId: user.id },
    select: {
      slug: true,
      published: true,
      _count: { select: { offerings: { where: { archived: false } } } },
    },
  });
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

  const paid = one(sp.paid);
  const flash =
    one(sp.saved) === "1"
      ? "Profile saved."
      : paid === "1"
        ? "Payment received. Featured listing or Verified Pro is active."
        : paid === "pending"
          ? "Payment is still pending. If you approved the M-Pesa prompt, it updates when Flutterwave confirms it."
          : paid === "cancelled"
            ? "Checkout cancelled. Nothing was charged."
            : paid === "failed"
              ? "Payment did not complete. Nothing was upgraded."
              : one(sp.deleted) === "1"
                ? "Listing deleted."
                : "";
  const paymentsConfig = paymentConfig();

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

      <section className={`${cardClass} grid gap-4 p-5`}>
        <h2 className="font-serif text-2xl text-navy">Your shop</h2>
        {!storefront ? (
          <>
            <p className="text-sm text-ink/70">
              You do not have a shop page yet. Create it from this profile, add an offering, then publish.
            </p>
            <SellerSteps current={1} />
            <Link href="/account/storefront" className={btnPrimary}>
              Open a shop
            </Link>
          </>
        ) : storefront._count.offerings === 0 ? (
          <>
            <p className="text-sm text-ink/70">
              Shop started at /b/{storefront.slug}. It is still a draft. Add a first offering next.
            </p>
            <SellerSteps current={2} />
            <Link href="/account/storefront#add-offering" className={btnPrimary}>
              Add your first offering
            </Link>
          </>
        ) : !storefront.published ? (
          <>
            <p className="text-sm text-ink/70">
              {storefront._count.offerings} offering{storefront._count.offerings === 1 ? "" : "s"} saved. The shop is still
              a draft, so buyers cannot open it yet.
            </p>
            <SellerSteps current={3} />
            <div className="flex flex-wrap gap-2">
              <Link href="/account/storefront" className={btnPrimary}>
                Publish shop
              </Link>
              <Link href={`/b/${storefront.slug}`} className={btnSecondary}>
                Preview shop
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/70">
              Published at /b/{storefront.slug}. Buyers message you on WhatsApp.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/b/${storefront.slug}`} className={btnPrimary}>
                View shop
              </Link>
              <Link href="/account/storefront" className={btnSecondary}>
                Manage storefront
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl">Your listings</h2>
          <Link href="/listings/new" className={btnSecondary}>
            List your business
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

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Payment settings</h2>
        <PaymentSetup mode={paymentsConfig.mode} webhookReady={paymentsConfig.webhookReady} />
      </section>

      <section className="grid gap-2">
        <h2 className="font-serif text-2xl">Receipts</h2>
        {payments.length === 0 ? <p className="text-sm text-ink/70">No payments yet.</p> : null}
        <ul className="grid gap-2">
          {payments.map((payment) => (
            <li key={payment.id} className="rounded-xl border border-sand bg-card p-3 text-sm">
              <p className="font-semibold">
                {productLabel(payment.product)} · {payment.amount}
                {payment.status === "paid" ? "" : ` · ${payment.status}`}
              </p>
              <p className="text-ink/70">
                {payment.method === "mpesa" ? "M-Pesa" : payment.method === "card" ? "Card" : payment.method} · {payment.reference}
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

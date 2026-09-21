import type { Metadata } from "next";
import Link from "next/link";
import { OfferingForm } from "@/components/offering-form";
import { StorefrontSettingsForm } from "@/components/storefront-settings-form";
import { Flash, btnPrimary } from "@/components/ui";
import { archiveOffering, createStorefront, moveOffering, restoreOffering } from "@/lib/actions/storefront";
import { FREE_OFFERING_CAP, PRO_OFFERING_CAP, offeringCap } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatOfferingPrice, one } from "@/lib/utils";

export const metadata: Metadata = { title: "Manage storefront" };

export default async function ManageStorefrontPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/account/storefront");
  const sp = await searchParams;
  const shop = await prisma.storefront.findUnique({
    where: { userId: user.id },
    include: { offerings: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });

  const cap = offeringCap(user.verifiedPro);
  const notice = one(sp.notice);
  const flash =
    notice === "created"
      ? "Shop started. Add an offering, then publish when you are ready."
      : notice === "saved"
        ? "Shop details saved."
        : notice === "offering"
          ? "Offering saved."
          : notice === "archived"
            ? "Offering archived."
            : notice === "restored"
              ? "Offering restored."
              : notice === "cap"
                ? user.verifiedPro
                  ? `Verified Pro shops can list ${cap} offerings.`
                  : `Free shops can list ${FREE_OFFERING_CAP} offerings. Verified Pro raises that to ${PRO_OFFERING_CAP}.`
                : "";

  if (!shop) {
    return (
      <div className="mx-auto grid max-w-2xl gap-4 px-4 py-8">
        <h1 className="font-serif text-3xl">Your shop</h1>
        <p className="text-sm text-ink/70">
          A shop page lists what you offer. Buyers open it from your directory listing and message you on WhatsApp. The address
          starts from your profile name. You can change it after.
        </p>
        <form action={createStorefront}>
          <button className={btnPrimary}>Start your shop</button>
        </form>
      </div>
    );
  }

  const active = shop.offerings.filter((offering) => !offering.archived);
  const archived = shop.offerings.filter((offering) => offering.archived);
  const currencyDefault = user.city === "London" ? "GBP" : "KES";

  return (
    <div className="mx-auto grid max-w-2xl gap-8 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Manage storefront</h1>
        <p className="mt-1 text-sm text-ink/70">
          {shop.published ? "Published" : "Draft"} · {active.length} of {cap} offerings
          {user.verifiedPro ? " · Verified Pro" : ""}
        </p>
        <Link href={`/b/${shop.slug}`} className="mt-2 inline-block text-sm font-semibold text-lake-dark">
          {shop.published ? "View shop" : "Preview shop"}
        </Link>
      </div>
      {flash ? <Flash>{flash}</Flash> : null}

      <StorefrontSettingsForm
        slug={shop.slug}
        bannerUrl={shop.bannerUrl}
        bio={user.bio}
        published={shop.published}
        verifiedPro={user.verifiedPro}
      />

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Offerings</h2>
        {active.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-sand bg-card p-6 text-sm">
            Add your first offering. A photo, a title, a price, and a short line are enough.
          </p>
        ) : (
          <ul className="grid gap-2">
            {active.map((offering, index) => (
              <li key={offering.id} className="rounded-xl border border-sand bg-card p-3 text-sm">
                <p className="font-semibold">{offering.title}</p>
                <p className="text-ink/70">{formatOfferingPrice(offering.priceCents, offering.currency) || "No price"}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <Link href={`/account/storefront/offerings/${offering.id}`} className="font-semibold text-lake-dark">
                    Edit
                  </Link>
                  {index > 0 ? (
                    <form action={moveOffering}>
                      <input type="hidden" name="id" value={offering.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button className="font-semibold text-lake-dark">Up</button>
                    </form>
                  ) : null}
                  {index < active.length - 1 ? (
                    <form action={moveOffering}>
                      <input type="hidden" name="id" value={offering.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button className="font-semibold text-lake-dark">Down</button>
                    </form>
                  ) : null}
                  <form action={archiveOffering}>
                    <input type="hidden" name="id" value={offering.id} />
                    <button className="font-semibold text-danger">Archive</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">{active.length === 0 ? "Add your first offering" : "Add an offering"}</h2>
        {active.length >= cap ? (
          <p className="text-sm text-ink/70">
            {user.verifiedPro
              ? `This shop is at the Verified Pro limit of ${cap}. Archive one to add another.`
              : `This shop is at the free limit of ${FREE_OFFERING_CAP}. Archive one, or get Verified Pro for ${PRO_OFFERING_CAP}.`}{" "}
            {!user.verifiedPro ? (
              <Link href="/upgrade" className="font-semibold text-lake-dark">
                See Promote
              </Link>
            ) : null}
          </p>
        ) : (
          <OfferingForm mode="create" currencyDefault={currencyDefault} />
        )}
      </section>

      {archived.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="font-serif text-2xl">Archived</h2>
          <ul className="grid gap-2">
            {archived.map((offering) => (
              <li key={offering.id} className="rounded-xl border border-sand bg-card p-3 text-sm">
                <p className="font-semibold">{offering.title}</p>
                <p className="text-ink/70">{formatOfferingPrice(offering.priceCents, offering.currency) || "No price"}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <Link href={`/account/storefront/offerings/${offering.id}`} className="font-semibold text-lake-dark">
                    Edit
                  </Link>
                  <form action={restoreOffering}>
                    <input type="hidden" name="id" value={offering.id} />
                    <button className="font-semibold text-lake-dark">Restore</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

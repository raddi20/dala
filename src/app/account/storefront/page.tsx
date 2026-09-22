import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { OfferingForm } from "@/components/offering-form";
import { SellerSteps } from "@/components/seller-steps";
import { StorefrontSettingsForm } from "@/components/storefront-settings-form";
import { Flash, btnPrimary, btnSecondary, btnWhatsApp, cardClass, sectionTitleClass } from "@/components/ui";
import { archiveOffering, createStorefront, moveOffering, publishStorefront, restoreOffering } from "@/lib/actions/storefront";
import { FREE_OFFERING_CAP, PRO_OFFERING_CAP, offeringCap } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatOfferingPrice, one } from "@/lib/utils";
import { whatsappOfferingLink, whatsappOfferingText } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Manage storefront" };

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

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
      ? "Shop started. Next: add a first offering, then publish."
      : notice === "saved"
        ? "Shop details saved."
        : notice === "first"
          ? shop?.published
            ? "First offering saved. Open the shop to see the WhatsApp button."
            : "First offering saved. Publish the shop, then preview the WhatsApp message."
          : notice === "offering"
            ? "Offering saved."
            : notice === "published"
              ? "Shop published. Buyers can open it and message you on WhatsApp."
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
    const hasWhatsapp = Boolean(user.whatsapp.trim() || user.phone.trim());
    return (
      <div className="mx-auto grid max-w-2xl gap-5 px-4 py-8">
        <div>
          <h1 className={sectionTitleClass}>Open a shop</h1>
          <p className="mt-2 text-sm text-ink/65">
            A shop page lists what you offer. Buyers open it and message you on WhatsApp. The address starts from your
            profile name. You can change it after.
          </p>
        </div>
        <div className={`${cardClass} grid gap-5 p-6`}>
          <SellerSteps current={1} />
          <div className="border-t border-sand/80 pt-5">
            <p className="text-sm text-ink/70">
              Shop name will be <span className="font-semibold text-navy">{user.name}</span>.
              {hasWhatsapp
                ? ` Buyers reach you on ${user.whatsapp || user.phone}.`
                : " Your profile has no WhatsApp number yet."}
            </p>
            {!hasWhatsapp ? (
              <p className="mt-2 text-sm">
                <Link href="/account#profile-whatsapp" className="font-semibold text-lake-dark hover:text-lake">
                  Add WhatsApp on Account
                </Link>
                <span className="text-ink/70"> before you publish, or start the shop now and add it later.</span>
              </p>
            ) : (
              <p className="mt-2 text-sm">
                <Link href="/account" className="font-semibold text-lake-dark hover:text-lake">
                  Edit profile
                </Link>
                <span className="text-ink/70"> if the name or number should change.</span>
              </p>
            )}
            <form action={createStorefront} className="mt-4">
              <button className={btnPrimary}>Start your shop</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const active = shop.offerings.filter((offering) => !offering.archived);
  const archived = shop.offerings.filter((offering) => offering.archived);
  const currencyDefault = user.city === "London" ? "GBP" : "KES";
  const readyToPublish = !shop.published && active.length > 0;
  const phone = user.whatsapp || user.phone;
  const first = active[0];
  const shopUrl = `${await origin()}/b/${shop.slug}`;
  const previewText = first ? whatsappOfferingText(first.title, shopUrl) : "";
  const previewChat = first && phone ? whatsappOfferingLink(phone, first.title, shopUrl) : "";

  return (
    <div className="mx-auto grid max-w-2xl gap-8 px-4 py-8">
      <div>
        <h1 className={sectionTitleClass}>Manage storefront</h1>
        <p className="mt-1 text-sm text-ink/65">
          {shop.published ? "Published" : "Draft"} · {active.length} of {cap} offerings
          {user.verifiedPro ? " · Verified Pro" : ""}
        </p>
        <Link href={`/b/${shop.slug}`} className="mt-2 inline-block text-sm font-semibold text-lake-dark hover:text-lake">
          {shop.published ? "View shop" : "Preview shop"}
        </Link>
      </div>
      {flash ? <Flash>{flash}</Flash> : null}
      {notice === "published" ? (
        <div className="flex flex-wrap gap-2">
          <Link href={`/b/${shop.slug}`} className={btnSecondary}>
            View shop
          </Link>
          {previewChat ? (
            <a href={previewChat} className={btnWhatsApp} target="_blank" rel="noreferrer">
              Preview WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}

      {!shop.published && active.length === 0 ? (
        <section className={`${cardClass} p-5`}>
          <h2 className="font-serif text-xl text-navy">Next steps</h2>
          <div className="mt-4">
            <SellerSteps current={2} />
          </div>
        </section>
      ) : null}

      {active.length === 0 ? (
        <section id="add-offering" className={`${cardClass} grid gap-3 p-5`}>
          <h2 className="font-serif text-xl text-navy">Add your first offering</h2>
          <p className="text-sm text-ink/65">
            This is step 2. A photo is optional. You can list {cap} active offerings
            {user.verifiedPro ? " on Verified Pro" : ` on the free plan, or ${PRO_OFFERING_CAP} with Verified Pro`}.
          </p>
          <OfferingForm mode="create" currencyDefault={currencyDefault} />
        </section>
      ) : null}

      {readyToPublish && first ? (
        <section className={`${cardClass} grid gap-3 border-clay/30 bg-amber-soft/50 p-5`}>
          <h2 className="font-serif text-xl text-navy">Publish, then check WhatsApp</h2>
          <p className="text-sm text-ink/75">
            {active.length === 1 ? "Your first offering is on the shop." : "The shop has offerings."} It is still a draft,
            so only you can open it. Publish, then preview the message a buyer would send about {first.title}.
          </p>
          <p className="rounded-xl bg-white px-3.5 py-2.5 text-sm text-ink/80">
            Buyers will send: &ldquo;{previewText}&rdquo;
          </p>
          {!phone ? (
            <p className="text-sm text-ink/75">
              Add a WhatsApp number so that button works.{" "}
              <Link href="/account#profile-whatsapp" className="font-semibold text-lake-dark hover:text-lake">
                Edit profile
              </Link>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <form action={publishStorefront}>
              <button className={btnPrimary}>Publish shop</button>
            </form>
            <Link href={`/b/${shop.slug}`} className={btnSecondary}>
              Preview shop
            </Link>
            {previewChat ? (
              <a href={previewChat} className={btnWhatsApp} target="_blank" rel="noreferrer">
                Preview WhatsApp
              </a>
            ) : null}
          </div>
          <p className="text-sm text-ink/60">
            Free shops list {FREE_OFFERING_CAP} offerings. Verified Pro lists {PRO_OFFERING_CAP}. You can turn publishing
            off later in shop settings.
          </p>
        </section>
      ) : null}

      <section id="shop-settings" className={`${cardClass} p-5`}>
        <h2 className="font-serif text-xl text-navy">Shop settings</h2>
        <div className="mt-4">
          <StorefrontSettingsForm
            slug={shop.slug}
            bannerUrl={shop.bannerUrl}
            bio={user.bio}
            published={shop.published}
            verifiedPro={user.verifiedPro}
            emphasizePublish={readyToPublish}
          />
        </div>
      </section>

      {active.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="font-serif text-2xl text-navy">Offerings</h2>
          <ul className="grid gap-2">
            {active.map((offering, index) => (
              <li key={offering.id} className={`${cardClass} p-4 text-sm`}>
                <p className="font-semibold text-navy">{offering.title}</p>
                <p className="text-ink/60">{formatOfferingPrice(offering.priceCents, offering.currency) || "No price"}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <Link href={`/account/storefront/offerings/${offering.id}`} className="font-semibold text-lake-dark hover:text-lake">
                    Edit
                  </Link>
                  {index > 0 ? (
                    <form action={moveOffering}>
                      <input type="hidden" name="id" value={offering.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button className="font-semibold text-lake-dark hover:text-lake">Up</button>
                    </form>
                  ) : null}
                  {index < active.length - 1 ? (
                    <form action={moveOffering}>
                      <input type="hidden" name="id" value={offering.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button className="font-semibold text-lake-dark hover:text-lake">Down</button>
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
        </section>
      ) : null}

      {active.length > 0 ? (
        <section className={`${cardClass} grid gap-3 p-5`}>
          <h2 className="font-serif text-xl text-navy">Add an offering</h2>
          {active.length >= cap ? (
            <p className="text-sm text-ink/65">
              {user.verifiedPro
                ? `This shop is at the Verified Pro limit of ${cap}. Archive one to add another.`
                : `This shop is at the free limit of ${FREE_OFFERING_CAP}. Archive one, or get Verified Pro for ${PRO_OFFERING_CAP}.`}{" "}
              {!user.verifiedPro ? (
                <Link href="/upgrade?product=verified_pro" className="font-semibold text-lake-dark hover:text-lake">
                  See Promote
                </Link>
              ) : null}
            </p>
          ) : (
            <OfferingForm mode="create" currencyDefault={currencyDefault} />
          )}
        </section>
      ) : null}

      {archived.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="font-serif text-2xl text-navy">Archived</h2>
          <ul className="grid gap-2">
            {archived.map((offering) => (
              <li key={offering.id} className={`${cardClass} p-4 text-sm`}>
                <p className="font-semibold text-navy">{offering.title}</p>
                <p className="text-ink/60">{formatOfferingPrice(offering.priceCents, offering.currency) || "No price"}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <Link href={`/account/storefront/offerings/${offering.id}`} className="font-semibold text-lake-dark hover:text-lake">
                    Edit
                  </Link>
                  <form action={restoreOffering}>
                    <input type="hidden" name="id" value={offering.id} />
                    <button className="font-semibold text-lake-dark hover:text-lake">Restore</button>
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

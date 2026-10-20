import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badges } from "@/components/badges";
import { FamilyOrderButton } from "@/components/family-order-button";
import { ReportForm } from "@/components/report-form";
import { ReviewForm } from "@/components/review-form";
import { RecentlyViewedStrip, TrackRecent } from "@/components/recently-viewed";
import { SaveHeart } from "@/components/save-heart";
import { UpgradeAction } from "@/components/upgrade-action";
import { Flash, cardClass, btnPrimary, btnSecondary, btnWhatsApp, fieldClass } from "@/components/ui";
import { blockUser } from "@/lib/actions/social";
import { setListingFeatured, setListingHidden, setListingVerified } from "@/lib/actions/admin";
import { listingOpenTo, publicReviewWhere } from "@/lib/visibility";
import { appName } from "@/lib/brand";
import { cityChipLabel, cityInPhrase } from "@/lib/constants";
import { requestLang } from "@/lib/i18n/request-lang";
import { uiText } from "@/lib/i18n/strings";
import {
  DEMO_LISTING_CONTACT_NOTE,
  isPublicDemoHidden,
  publicSellerContacts,
  publicTextWithoutDemoNumbers,
} from "@/lib/demo-visibility";
import { DemoContactNote, PaymentSafetyNote } from "@/components/seller-contact";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isProActive } from "@/lib/pro";
import { averageRating, formatWhen, one, telHref } from "@/lib/utils";
import { paymentsLive } from "@/lib/payments/live";
import { publicOrigin } from "@/lib/payments/origin";
import { buildShareMetadata, clipText, listingPreviewImage, privateMetadata } from "@/lib/share-metadata";
import { whatsappChatLink, whatsappShareLink } from "@/lib/whatsapp";
import { cardPhoto } from "@/lib/image-variants";
import { variantMap } from "@/lib/image-variant-store";
import { liteMode } from "@/lib/weak-data";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await prisma.listing.findUnique({
    where: { id },
    select: {
      title: true,
      description: true,
      hidden: true,
      photoUrl: true,
      city: true,
      category: true,
      contactPhone: true,
      contactWhatsapp: true,
      ownerId: true,
      owner: { select: { email: true, suspended: true } },
    },
  });
  if (!listing || isPublicDemoHidden(listing.owner.email)) return privateMetadata("Listing");
  const viewer = await getSessionUser();
  const open = listingOpenTo(viewer, {
    hidden: listing.hidden,
    ownerId: listing.ownerId,
    ownerSuspended: listing.owner.suspended,
  });
  if (!open) return privateMetadata("Listing");
  if (listing.hidden || listing.owner.suspended) return { title: listing.title, robots: { index: false, follow: false } };
  const origin = await publicOrigin();
  const preview = listingPreviewImage({ origin, id, hidden: false, photoUrl: listing.photoUrl });
  if (!preview) return privateMetadata("Listing");
  const description = publicTextWithoutDemoNumbers(
    listing.owner.email,
    clipText(listing.description) || `${listing.title} ${cityInPhrase(listing.city)}. ${listing.category} on ${appName()}.`,
    [listing.contactPhone, listing.contactWhatsapp],
  );
  return buildShareMetadata({
    origin,
    path: `/listings/${id}`,
    title: listing.title,
    description,
    image: preview.url,
    imageAlt: listing.title,
    imageType: preview.generated ? "image/png" : null,
  });
}

export default async function ListingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const listing = await prisma.listing.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          kind: true,
          verifiedPro: true,
          verifiedProUntil: true,
          suspended: true,
          storefront: {
            select: {
              slug: true,
              published: true,
              hidden: true,
              phoneVerified: true,
              locationVerified: true,
              businessVerified: true,
              servesDiaspora: true,
            },
          },
        },
      },
      reviews: {
        where: publicReviewWhere,
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!listing || isPublicDemoHidden(listing.owner.email)) notFound();

  const user = await getSessionUser();
  const lang = await requestLang();
  const isOwner = user?.id === listing.ownerId;
  const upgradesOpen = paymentsLive();
  const isAdmin = user?.role === "admin";
  if (
    !listingOpenTo(user, {
      hidden: listing.hidden,
      ownerId: listing.ownerId,
      ownerSuspended: listing.owner.suspended,
    })
  ) {
    notFound();
  }

  const blocked = user
    ? await prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: user.id, blockedId: listing.ownerId } },
      })
    : null;
  const rating = averageRating(listing.reviews);
  const listingUrl = `${await publicOrigin()}/listings/${listing.id}`;
  const shareUrl = whatsappShareLink(listing.title, listingUrl);
  const contacts = publicSellerContacts({
    email: listing.owner.email,
    phone: listing.contactPhone,
    whatsapp: listing.contactWhatsapp,
  });
  const chatUrl = contacts.whatsapp ? whatsappChatLink(contacts.whatsapp, listing.title, listingUrl, lang) : "";
  const shopRecord = listing.owner.storefront;
  const shop = shopRecord?.published && !shopRecord.hidden && !listing.owner.suspended ? shopRecord : null;
  const callUrl = telHref(contacts.phone);
  const storedPhoto = listing.photoUrl ? (await variantMap([listing.photoUrl])).get(listing.photoUrl) : undefined;
  const photo = cardPhoto({
    src: listing.photoUrl,
    thumb480: storedPhoto?.thumb480,
    thumb960: storedPhoto?.thumb960,
    width: 960,
    height: 600,
    sizes: "(min-width: 768px) 720px, 100vw",
    priority: true,
    lite: await liteMode(),
  });
  const savedItem = {
    id: listing.id,
    title: listing.title,
    photo: photo?.src ?? "",
    price: listing.priceLabel,
    place: cityChipLabel(listing.city),
  };
  const notice =
    one(sp.posted) === "1" ? "Listing published." : one(sp.updated) === "1" ? "Changes saved." : "";

  return (
    <article className={`mx-auto grid max-w-3xl gap-6 px-4 py-8 sm:pb-10 ${chatUrl ? "pb-40" : "pb-28"}`}>
      {notice ? <Flash>{notice}</Flash> : null}
      {listing.hidden || listing.owner.suspended ? (
        <Flash>
          {`${
            listing.owner.suspended
              ? "This account is suspended, so the listing is hidden from buyers."
              : "This listing is hidden from browse. Only you and moderators can open it."
          }${listing.hiddenReason ? ` ${listing.hiddenReason}` : ""}`}
        </Flash>
      ) : null}

      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.src}
          srcSet={photo.srcSet}
          sizes={photo.sizes}
          width={photo.width}
          height={photo.height}
          alt={listing.title}
          loading={photo.loading}
          decoding={photo.decoding}
          fetchPriority={photo.fetchPriority}
          className="aspect-[16/10] h-auto w-full rounded-[14px] border border-line/80 bg-sand object-cover shadow-[var(--shadow-card)]"
        />
      ) : (
        <div className="flex aspect-[16/10] items-end rounded-[1.25rem] bg-gradient-to-br from-navy via-navy-soft to-lake-dark p-5 text-white shadow-[var(--shadow-card)]">
          <span className="font-serif text-4xl">{listing.title.charAt(0).toUpperCase()}</span>
          <span className="ml-auto text-sm uppercase tracking-wide text-white/80">{listing.category}</span>
        </div>
      )}

      <div className="grid gap-3">
        <Badges
          type={listing.type}
          verified={listing.verified}
          verifiedPro={isProActive(listing.owner)}
          shopBadges={listing.owner.storefront}
          servesDiaspora={Boolean(listing.owner.storefront?.servesDiaspora)}
          featured={listing.featured}
          featuredUntil={listing.featuredUntil}
          scamRisk={listing.scamRisk}
        />
        <h1 className="font-serif text-3xl leading-tight text-navy sm:text-4xl">{listing.title}</h1>
        <p className="text-ink/65">
          {listing.region === "diaspora" ? uiText(lang, "diaspora") : `${cityChipLabel(listing.city)} · ${uiText(lang, "homeland")}`} · {listing.category}
          {listing.address ? ` · ${listing.address}` : ""}
        </p>
        {listing.priceLabel ? <p className="text-lg font-semibold text-ink">{listing.priceLabel}</p> : null}
        <SaveHeart variant="page" item={savedItem} />
        <TrackRecent item={savedItem} />
        <p className="text-sm text-ink/55">
          {rating === null
            ? uiText(lang, "no_reviews")
            : `${rating.toFixed(1)} out of 5 from ${listing.reviews.length} review${listing.reviews.length === 1 ? "" : "s"}`}
          {" · "}
          {formatWhen(listing.createdAt)}
        </p>
      </div>

      {listing.scamRisk !== "low" ? (
        <div className="rounded-[1.25rem] border border-warn/30 bg-amber-soft p-4 text-sm">
          <p className="font-semibold text-warn">Automatic check: {listing.scamRisk} risk</p>
          <p className="mt-1 text-ink/80">{listing.scamNotes}</p>
          <p className="mt-2 text-ink/60">Do not send money before you have met or inspected what is advertised.</p>
        </div>
      ) : null}

      <div className="hidden flex-col gap-2 sm:flex sm:flex-row sm:flex-wrap">
        {chatUrl ? (
          <a href={chatUrl} data-tour="whatsapp" className={btnWhatsApp} target="_blank" rel="noreferrer">
            {uiText(lang, "whatsapp_seller")}
          </a>
        ) : null}
        {contacts.whatsapp ? (
          <FamilyOrderButton
            phone={contacts.whatsapp}
            subjectName={listing.title}
            path={`/listings/${listing.id}`}
            siteName={appName()}
            lang={lang}
          />
        ) : null}
        <a href={shareUrl} className={btnSecondary} target="_blank" rel="noreferrer">
          {uiText(lang, "share_whatsapp")}
        </a>
        {callUrl ? (
          <a href={callUrl} className={btnSecondary}>
            {uiText(lang, "call")}
          </a>
        ) : null}
        {shop ? (
          <Link href={`/b/${shop.slug}`} className={btnSecondary}>
            {uiText(lang, "visit_shop")}
          </Link>
        ) : null}
        {isOwner ? (
          <>
            <Link href={`/listings/${listing.id}/edit`} className={btnSecondary}>
              {uiText(lang, "edit")}
            </Link>
            <Link href="/account/storefront" className={btnSecondary}>
              {uiText(lang, "manage_shop")}
            </Link>
            <UpgradeAction
              live={upgradesOpen}
              href={`/upgrade?listing=${listing.id}`}
              label={uiText(lang, "feature_listing")}
              className={btnSecondary}
            />
          </>
        ) : null}
        {chatUrl || callUrl ? <PaymentSafetyNote className="basis-full" /> : null}
      </div>

      <div className="whitespace-pre-wrap text-base leading-relaxed text-ink/90">{listing.description}</div>

      <section className={`${cardClass} p-5`}>
        <h2 className="font-serif text-xl text-navy">{uiText(lang, "contact")}</h2>
        <p className="mt-1">{listing.contactName || listing.owner.name}</p>
        {contacts.hidden ? (
          <DemoContactNote note={DEMO_LISTING_CONTACT_NOTE} />
        ) : (
          <>
            {contacts.phone ? <p className="text-sm text-ink/70">{contacts.phone}</p> : null}
            {contacts.whatsapp ? <p className="text-sm text-ink/70">WhatsApp {contacts.whatsapp}</p> : null}
          </>
        )}
        <Link href={`/people/${listing.owner.id}`} className="mt-3 inline-block text-sm font-semibold text-lake-dark hover:text-lake">
          {listing.owner.kind === "business" ? uiText(lang, "view_business") : uiText(lang, "view_person")}
        </Link>
      </section>

      <section id="reviews" className="grid gap-4">
        <h2 className="font-serif text-2xl text-navy">{uiText(lang, "reviews")}</h2>
        {listing.reviews.length === 0 ? <p className="text-sm text-ink/60">{uiText(lang, "no_reviews_dot")}</p> : null}
        <ul className="grid gap-3">
          {listing.reviews.map((review) => (
            <li key={review.id} className={`${cardClass} p-4`}>
              <p className="text-sm font-semibold">
                {review.rating} / 5 · {review.author.name}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">{review.body}</p>
              <p className="mt-2 text-xs text-ink/45">{formatWhen(review.createdAt)}</p>
            </li>
          ))}
        </ul>
        {user && !isOwner ? <ReviewForm listingId={listing.id} /> : null}
        {!user ? (
          <Link href={`/login?next=/listings/${listing.id}`} className="text-sm font-semibold text-lake-dark hover:text-lake">
            {uiText(lang, "sign_in_review")}
          </Link>
        ) : null}
      </section>

      {user && !isOwner ? (
        <section className="grid gap-3">
          <details className={`${cardClass} p-4`}>
            <summary className="cursor-pointer text-sm font-semibold">{uiText(lang, "report_listing")}</summary>
            <div className="mt-3">
              <ReportForm listingId={listing.id} targetUserId={listing.ownerId} />
            </div>
          </details>
          {blocked ? (
            <p className="text-sm text-ink/60">You have blocked this person. Their other listings are hidden from your browse.</p>
          ) : (
            <form action={blockUser}>
              <input type="hidden" name="userId" value={listing.ownerId} />
              <input type="hidden" name="returnTo" value={`/listings/${listing.id}`} />
              <button className="text-sm font-semibold text-danger">{uiText(lang, "block_person")}</button>
            </form>
          )}
        </section>
      ) : null}

      {isAdmin ? (
        <section className={`grid gap-2 ${cardClass} p-4`}>
          <h2 className="font-serif text-xl text-navy">Moderation</h2>
          <div className="flex flex-wrap gap-2">
            <form action={setListingHidden} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="hidden" value={listing.hidden ? "0" : "1"} />
              <label className="grid gap-1 text-sm">
                Reason
                <input name="reason" required minLength={3} maxLength={500} className={fieldClass} placeholder="Why" />
              </label>
              <button className={btnSecondary}>{listing.hidden ? "Unhide" : "Hide"}</button>
            </form>
            <form action={setListingVerified}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="verified" value={listing.verified ? "0" : "1"} />
              <button className={btnSecondary}>{listing.verified ? "Remove verified" : "Grant verified"}</button>
            </form>
            <form action={setListingFeatured}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="featured" value={listing.featured ? "0" : "1"} />
              <button className={btnSecondary}>{listing.featured ? "Remove featured" : "Feature for 30 days"}</button>
            </form>
          </div>
        </section>
      ) : null}

      <RecentlyViewedStrip skipId={listing.id} />

      {/* Mobile action row for non-WhatsApp actions */}
      <div className="flex flex-col gap-2 sm:hidden">
        <a href={shareUrl} className={btnSecondary} target="_blank" rel="noreferrer">
          {uiText(lang, "share_whatsapp")}
        </a>
        {callUrl ? (
          <a href={callUrl} className={btnSecondary}>
            {uiText(lang, "call")}
          </a>
        ) : null}
        {callUrl ? <PaymentSafetyNote /> : null}
        {shop ? (
          <Link href={`/b/${shop.slug}`} className={btnSecondary}>
            {uiText(lang, "visit_shop")}
          </Link>
        ) : null}
        {isOwner ? (
          <>
            <Link href={`/listings/${listing.id}/edit`} className={btnSecondary}>
              {uiText(lang, "edit")}
            </Link>
            <Link href="/account/storefront" className={btnSecondary}>
              {uiText(lang, "manage_shop")}
            </Link>
            <UpgradeAction
              live={upgradesOpen}
              href={`/upgrade?listing=${listing.id}`}
              label={uiText(lang, "feature_listing")}
              className={btnSecondary}
            />
          </>
        ) : null}
      </div>

      {chatUrl ? (
        <div className="sticky-cta-bar fixed inset-x-0 z-30 border-t border-sand/80 bg-card/95 px-4 py-3 shadow-[0_-8px_24px_rgb(20_26_36/0.08)] backdrop-blur sm:hidden">
          <div className="grid gap-2">
            <FamilyOrderButton
              variant="bar"
              phone={contacts.whatsapp}
              subjectName={listing.title}
              path={`/listings/${listing.id}`}
              siteName={appName()}
              lang={lang}
            />
            <a href={chatUrl} data-tour="whatsapp" className={`${btnWhatsApp} w-full`} target="_blank" rel="noreferrer">
              {uiText(lang, "whatsapp_seller")}
            </a>
            <PaymentSafetyNote />
          </div>
        </div>
      ) : (
        <div className="sticky-cta-bar fixed inset-x-0 z-30 border-t border-sand/80 bg-card/95 px-4 py-3 shadow-[0_-8px_24px_rgb(20_26_36/0.08)] backdrop-blur sm:hidden">
          <a href={shareUrl} className={`${btnPrimary} w-full`} target="_blank" rel="noreferrer">
            {uiText(lang, "share_whatsapp")}
          </a>
        </div>
      )}
    </article>
  );
}

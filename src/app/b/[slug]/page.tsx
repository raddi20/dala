import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ShopBadgeNotes } from "@/components/badges";
import { FamilyOrderButton } from "@/components/family-order-button";
import { RemoteImage } from "@/components/remote-image";
import { ReportForm } from "@/components/report-form";
import { EmptyState, Flash, btnWhatsApp, cardClass } from "@/components/ui";
import { appName } from "@/lib/brand";
import { cityInPhrase } from "@/lib/constants";
import { requestLang } from "@/lib/i18n/request-lang";
import { uiFill, uiText } from "@/lib/i18n/strings";
import {
  DEMO_SHOP_CONTACT_NOTE,
  isPublicDemoHidden,
  publicSellerContacts,
  publicTextWithoutDemoNumbers,
} from "@/lib/demo-visibility";
import { ProtectedOrderPanel } from "@/components/protected-order-panel";
import { DemoContactNote, PaymentSafetyNote } from "@/components/seller-contact";
import { protectedOrdersOn } from "@/lib/protected-order";
import { isProActive, visibleOfferings } from "@/lib/pro";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { shopReviews, shopSignals } from "@/lib/storefront";
import { shopOpenTo } from "@/lib/visibility";
import { averageRating, formatOfferingPrice, formatWhen, one, telHref } from "@/lib/utils";
import { publicOrigin } from "@/lib/payments/origin";
import { countStickerScan } from "@/lib/sticker-shop";
import { isPrefetchRequest } from "@/lib/sticker";
import { buildShareMetadata, clipText, privateMetadata, shopPreviewImage } from "@/lib/share-metadata";
import { whatsappOfferingLink, whatsappShareLink, whatsappShopLink } from "@/lib/whatsapp";
import { CARD_SIZES, cardPhoto } from "@/lib/image-variants";
import { variantMap } from "@/lib/image-variant-store";
import { shopPlaceLine, shopTrustLine } from "@/lib/shop-trust";
import { ShopVideoPoster } from "@/components/shop-video-poster";
import { videoMode } from "@/lib/video/config";
import { shopVideoIsPublic } from "@/lib/video/machine";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const shop = await prisma.storefront.findUnique({
    where: { slug },
    select: {
      published: true,
      hidden: true,
      bannerUrl: true,
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
          bio: true,
          city: true,
          avatarUrl: true,
          phone: true,
          whatsapp: true,
          verifiedPro: true,
          verifiedProUntil: true,
          suspended: true,
        },
      },
      videos: {
        where: { status: "approved", NOT: { publicPlaybackId: "" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true, publicPlaybackId: true },
      },
    },
  });
  if (!shop || isPublicDemoHidden(shop.user.email)) return privateMetadata("Shop");
  const viewer = await getSessionUser();
  const open = shopOpenTo(viewer, {
    published: shop.published,
    hidden: shop.hidden,
    ownerId: shop.userId,
    ownerSuspended: shop.user.suspended,
  });
  if (!open) return privateMetadata("Shop");
  if (!shop.published || shop.hidden || shop.user.suspended) return { title: shop.user.name, robots: { index: false, follow: false } };
  const origin = await publicOrigin();
  const proActive = isProActive(shop.user);
  const clip = shop.videos[0];
  const hasPublicVideo = clip
    ? shopVideoIsPublic({
        verifiedPro: proActive,
        published: true,
        status: clip.status,
        publicPlaybackId: clip.publicPlaybackId,
      })
    : false;
  const preview = shopPreviewImage({
    origin,
    slug,
    published: true,
    verifiedPro: proActive,
    bannerUrl: shop.bannerUrl,
    avatarUrl: shop.user.avatarUrl,
    hasPublicVideo,
  });
  if (!preview) return privateMetadata("Shop");
  const description = publicTextWithoutDemoNumbers(
    shop.user.email,
    clipText(shop.user.bio) || `${shop.user.name} ${cityInPhrase(shop.user.city)}. A shop on ${appName()}. Chat stays on WhatsApp.`,
    [shop.user.phone, shop.user.whatsapp],
  );
  return buildShareMetadata({
    origin,
    // Shop path only. Share metadata drops ?ref so a sticker visit is not canonical.
    path: `/b/${slug}`,
    title: shop.user.name,
    description,
    image: preview.url,
    imageAlt: shop.user.name,
    imageType: preview.contentType,
  });
}

export default async function StorefrontPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const shop = await prisma.storefront.findUnique({
    where: { slug },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          bio: true,
          city: true,
          avatarUrl: true,
          phone: true,
          whatsapp: true,
          verifiedPro: true,
          verifiedProUntil: true,
          suspended: true,
        },
      },
      offerings: {
        where: { archived: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
      badgeEvents: { orderBy: { createdAt: "desc" } },
      videos: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!shop || isPublicDemoHidden(shop.user.email)) notFound();

  const viewer = await getSessionUser();
  const lang = await requestLang();
  const isOwner = viewer?.id === shop.userId;
  if (
    !shopOpenTo(viewer, {
      published: shop.published,
      hidden: shop.hidden,
      ownerId: shop.userId,
      ownerSuspended: shop.user.suspended,
    })
  ) {
    notFound();
  }

  if (viewer && !isOwner) {
    const blocked = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: shop.userId } },
    });
    if (blocked) notFound();
  }

  const headerList = await headers();
  await countStickerScan({
    storefrontId: shop.id,
    ref: one(query.ref),
    userAgent: headerList.get("user-agent") ?? "",
    published: shop.published,
    publiclyHidden: false,
    shopHidden: shop.hidden,
    ownerSuspended: shop.user.suspended,
    prefetch: isPrefetchRequest((name) => headerList.get(name)),
  });

  const [signals, reviews] = await Promise.all([shopSignals(shop.userId), shopReviews(shop.userId)]);
  const rating = averageRating(reviews);
  const url = `${await publicOrigin()}/b/${shop.slug}`;
  const contacts = publicSellerContacts(shop.user);
  const phone = contacts.whatsapp || contacts.phone;
  const chatUrl = phone ? whatsappShopLink(phone, url) : "";
  const callUrl = telHref(contacts.phone);
  const shareUrl = whatsappShareLink(shop.user.name, url);
  const initial = shop.user.name.trim().charAt(0).toUpperCase() || "·";
  const proActive = isProActive(shop.user);
  const isAdmin = viewer?.role === "admin";
  const liveOfferings = shop.offerings.filter((offering) => !offering.hidden);
  const publicOfferings = visibleOfferings(liveOfferings, proActive);
  const bannerSrc = proActive ? shop.bannerUrl.trim() : "";
  const photoVariants = await variantMap([
    bannerSrc,
    shop.user.avatarUrl,
    ...publicOfferings.map((offering) => offering.imageUrl),
  ]);
  const coverUrl = bannerSrc || publicOfferings.find((offering) => offering.imageUrl.trim())?.imageUrl || "";
  const coverStored = coverUrl ? photoVariants.get(coverUrl) : undefined;
  const cover = cardPhoto({
    src: coverUrl,
    thumb480: coverStored?.thumb480,
    thumb960: coverStored?.thumb960,
    width: 960,
    height: 420,
    sizes: "(min-width: 768px) 768px, 100vw",
  });
  const avatarStored = shop.user.avatarUrl ? photoVariants.get(shop.user.avatarUrl) : undefined;
  const avatar = cardPhoto({
    src: shop.user.avatarUrl,
    thumb480: avatarStored?.thumb480,
    thumb960: avatarStored?.thumb960,
    width: 80,
    height: 80,
    sizes: "64px",
  });
  const moderatorHidden = isOwner || isAdmin ? shop.offerings.filter((offering) => offering.hidden) : [];
  const publicVideo = shop.videos.find((video) =>
    shopVideoIsPublic({
      verifiedPro: proActive,
      published: shop.published || isOwner,
      status: video.status,
      publicPlaybackId: video.publicPlaybackId,
    }),
  );
  const showVideo = Boolean(publicVideo && (shop.published || isOwner) && proActive);
  const shopBadges = {
    phoneVerified: shop.phoneVerified,
    locationVerified: shop.locationVerified,
    businessVerified: shop.businessVerified,
  };
  const trust = shopTrustLine({ ...shopBadges, verified: signals.verified });
  const place = shopPlaceLine(signals.category, shop.user.city);
  const bio = shop.user.bio
    ? publicTextWithoutDemoNumbers(shop.user.email, shop.user.bio, [shop.user.phone, shop.user.whatsapp])
    : "";
  const shopParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const item = Array.isArray(value) ? value[0] : value;
    if (item) shopParams.set(key, item);
  }
  const shopHref = shopParams.size ? `/b/${shop.slug}?${shopParams}` : `/b/${shop.slug}`;

  return (
    <article className={`mx-auto grid max-w-3xl gap-5 px-4 py-4 ${chatUrl ? "pb-40" : "pb-8"}`}>
      {shop.hidden && (isOwner || viewer?.role === "admin") ? (
        <Flash>
          {`A moderator hid this shop from buyers.${shop.hiddenReason ? ` ${shop.hiddenReason}` : ""} Publishing again does not undo that.`}
        </Flash>
      ) : null}
      {shop.user.suspended && viewer?.role === "admin" ? (
        <Flash>This account is suspended, so the shop is hidden from buyers.</Flash>
      ) : null}

      {!shop.published && isOwner ? (
        <div className="grid gap-2">
          <Flash>This shop is a draft. Only you can see this preview.</Flash>
          <p className="text-sm text-ink/70">
            <Link href="/account/storefront" className="font-semibold text-lake-dark hover:text-lake">
              {shop.offerings.length > 0 ? "Publish the shop" : "Finish shop setup"}
            </Link>
            {shop.offerings.length > 0
              ? " so buyers can use the WhatsApp button on this page."
              : " — add an offering, then publish."}
          </p>
        </div>
      ) : null}

      <header>
        <div className="-mx-4 h-[210px] overflow-hidden bg-navy">
          <RemoteImage
            src={cover?.src ?? ""}
            srcSet={cover?.srcSet}
            sizes={cover?.sizes}
            width={cover?.width ?? 960}
            height={210}
            alt=""
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="h-[210px] w-full object-cover"
          >
            <div className="h-[210px] bg-navy" />
          </RemoteImage>
        </div>
        <div className="relative z-10 -mt-8">
          <RemoteImage
            src={avatar?.src ?? ""}
            srcSet={avatar?.srcSet}
            sizes={avatar?.sizes}
            width={64}
            height={64}
            alt=""
            className="h-16 w-16 rounded-2xl border-4 border-bg object-cover"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-bg bg-navy font-serif text-2xl text-white">
              {initial}
            </div>
          </RemoteImage>
        </div>
        <h1 className="mt-3 font-serif text-[25px] leading-tight text-navy">{shop.user.name}</h1>
        {place ? <p className="mt-1 text-sm text-muted">{place}</p> : null}
        {trust ? (
          shopBadges.phoneVerified || shopBadges.locationVerified || shopBadges.businessVerified ? (
            <details className="filter-sheet mt-1">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-navy marker:content-none [&::-webkit-details-marker]:hidden">
                {trust}
                <span aria-hidden="true"> ›</span>
              </summary>
              <div className="filter-sheet-layer">
                <a className="filter-sheet-scrim" href={shopHref} aria-label={uiText(lang, "close_checks")} />
                <div className="filter-sheet-panel" role="dialog" aria-label={uiText(lang, "checked_by")}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="font-serif text-xl text-navy">{uiText(lang, "checked_by")}</h2>
                    <a href={shopHref} className="text-sm font-semibold text-gold-d">
                      {uiText(lang, "close")}
                    </a>
                  </div>
                  <ShopBadgeNotes flags={shopBadges} events={shop.badgeEvents} />
                </div>
              </div>
            </details>
          ) : (
            <p className="mt-1 text-sm font-semibold text-navy">{trust}</p>
          )
        ) : null}
        <div className="mt-3 flex gap-6">
          {callUrl ? (
            <a href={callUrl} className="inline-flex min-h-11 min-w-11 flex-col items-center gap-1 text-xs font-semibold text-ink">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                  <path d="M7 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L17 13l4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z" />
                </svg>
              </span>
              {uiText(lang, "call")}
            </a>
          ) : null}
          {shareUrl ? (
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 min-w-11 flex-col items-center gap-1 text-xs font-semibold text-ink"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                  <path d="M14 4l6 6-6 6v-4H9a6 6 0 0 0-6 6v1h2v-1a4 4 0 0 1 4-4h5v-4z" />
                </svg>
              </span>
              {uiText(lang, "share")}
            </a>
          ) : null}
        </div>
        {contacts.hidden ? <DemoContactNote note={DEMO_SHOP_CONTACT_NOTE} /> : null}
      </header>

      {showVideo && publicVideo ? (
        <section aria-label={uiText(lang, "shop_video")}>
          <ShopVideoPoster
            playbackId={publicVideo.publicPlaybackId}
            posterUrl={publicVideo.posterUrl}
            caption={publicVideo.caption}
            mock={videoMode() === "mock" || publicVideo.publicPlaybackId.startsWith("mock")}
          />
        </section>
      ) : null}

      <nav aria-label={uiText(lang, "shop_sections")} className="flex gap-1 border-b border-line">
        <a href="#offerings" className="inline-flex min-h-11 items-center border-b-2 border-navy px-2 text-sm font-semibold text-navy">
          {uiText(lang, "offerings")} ({publicOfferings.length})
        </a>
        <a href="#about" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-muted">
          {uiText(lang, "about")}
        </a>
        <a href="#reviews" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-muted">
          {uiText(lang, "reviews")}
          {reviews.length > 0 ? ` (${reviews.length})` : ""}
        </a>
      </nav>

      <section id="offerings" className="grid scroll-mt-28 gap-3">
        <h2 className="sr-only">{uiText(lang, "offerings")}</h2>
        {publicOfferings.length === 0 ? (
          <EmptyState title={uiText(lang, "no_offerings")} body={uiText(lang, "no_offerings_body")} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {publicOfferings.map((offering) => {
              const price = formatOfferingPrice(offering.priceCents, offering.currency);
              const offeringChat = phone ? whatsappOfferingLink(phone, offering.title, url) : "";
              const stored = photoVariants.get(offering.imageUrl);
              const photo = cardPhoto({
                src: offering.imageUrl,
                thumb480: stored?.thumb480,
                thumb960: stored?.thumb960,
                width: 480,
                height: 360,
                sizes: CARD_SIZES,
              });
              return (
                <article
                  key={offering.id}
                  id={`offering-${offering.id}`}
                  className={`card-lift scroll-mt-28 flex flex-col overflow-hidden ${cardClass}`}
                >
                  <RemoteImage
                    src={photo?.src ?? ""}
                    srcSet={photo?.srcSet}
                    sizes={photo?.sizes}
                    width={photo?.width}
                    height={photo?.height}
                    loading={photo?.loading}
                    decoding={photo?.decoding}
                    fetchPriority={photo?.fetchPriority}
                    alt=""
                    className="aspect-[4/3] h-auto w-full object-cover"
                  >
                    <div className="aspect-[4/3] bg-navy" />
                  </RemoteImage>
                  <div className="flex flex-1 flex-col gap-1 px-2.5 pb-3 pt-2">
                    <h3 className="line-clamp-2 font-sans text-[14.5px] font-semibold leading-snug tracking-normal text-ink">
                      {offering.title}
                    </h3>
                    {price ? <p className="text-sm font-semibold text-ink">{price}</p> : null}
                    {offering.description ? <p className="line-clamp-2 text-xs leading-relaxed text-muted">{offering.description}</p> : null}
                    {offeringChat ? (
                      <a
                        href={offeringChat}
                        className="mt-auto inline-flex min-h-11 items-center justify-center rounded-full bg-wa px-3 text-xs font-semibold text-white hover:bg-wa-d"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {uiText(lang, "ask_whatsapp")}
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {moderatorHidden.length > 0 ? (
          <p className="text-sm text-ink/70">
            {moderatorHidden.length} offering{moderatorHidden.length === 1 ? " is" : "s are"} hidden by a moderator and{" "}
            {moderatorHidden.length === 1 ? "is" : "are"} not shown to buyers: {moderatorHidden.map((offering) => offering.title).join(", ")}.
          </p>
        ) : null}
        <PaymentSafetyNote />
      </section>

      {protectedOrdersOn() ? (
        <ProtectedOrderPanel
          slug={shop.slug}
          subaccount={shop.paystackSubaccountCode}
          offerings={publicOfferings
            .filter((offering) => offering.currency === "KES" && offering.priceCents != null && offering.priceCents > 0)
            .map((offering) => ({
              id: offering.id,
              title: offering.title,
              unitSubunit: offering.priceCents as number,
            }))}
        />
      ) : null}

      <section id="about" className="scroll-mt-28 grid gap-2">
        <h2 className="font-serif text-xl text-navy">{uiText(lang, "about")}</h2>
        {bio ? (
          <p className="whitespace-pre-wrap leading-relaxed text-ink/85">{bio}</p>
        ) : (
          <p className="text-sm text-muted">{uiText(lang, "shop_no_about")}</p>
        )}
        {signals.address ? <p className="text-sm text-muted">{signals.address}</p> : null}
        {shop.servesDiaspora ? <p className="text-sm text-ink/80">{uiText(lang, "family_orders_note")}</p> : null}
        {signals.listingId ? (
          <Link href={`/listings/${signals.listingId}`} className="text-sm font-semibold text-gold-d">
            {uiText(lang, "directory_listing")}
            {signals.listingTitle ? `: ${signals.listingTitle}` : ""}
          </Link>
        ) : null}
        <p className="text-sm">
          <Link href={`/people/${shop.user.id}`} className="font-semibold text-gold-d">
            {uiText(lang, "view_profile")}
          </Link>
        </p>
      </section>

      <section id="reviews" className="grid scroll-mt-28 gap-3">
        <h2 className="font-serif text-xl text-navy">{uiText(lang, "reviews")}</h2>
        {reviews.length === 0 ? (
          <EmptyState title={uiText(lang, "no_reviews_shop")} body={uiText(lang, "no_reviews_shop_body")} />
        ) : (
          <>
            <p className="text-sm text-ink/60">
              {rating === null
                ? uiText(lang, "no_reviews_dot")
                : `${rating.toFixed(1)} out of 5 from ${reviews.length} review${reviews.length === 1 ? "" : "s"} on this seller's listings.`}
            </p>
            <ul className="grid gap-3">
              {reviews.map((review) => (
                <li key={review.id} className={`${cardClass} p-4`}>
                  <p className="text-sm font-semibold">
                    {review.rating} / 5 · {review.author.name}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink/80">{review.body}</p>
                  <p className="mt-2 text-xs text-ink/45">
                    <Link href={`/listings/${review.listing.id}#reviews`} className="font-semibold text-gold-d">
                      {review.listing.title}
                    </Link>
                    {" · "}
                    {formatWhen(review.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {viewer && !isOwner ? (
        <details className={`${cardClass} p-4`}>
          <summary className="cursor-pointer text-sm font-semibold">{uiText(lang, "report_shop")}</summary>
          <div className="mt-3">
            <ReportForm targetUserId={shop.userId} />
          </div>
        </details>
      ) : null}
      {!viewer ? (
        <Link href={`/login?next=/b/${shop.slug}`} className="text-sm font-semibold text-lake-dark hover:text-lake">
          {uiText(lang, "sign_in_report")}
        </Link>
      ) : null}

      {chatUrl ? (
        <div className="sticky-cta-bar fixed inset-x-0 z-30 border-t border-line/80 bg-card px-4 py-3 shadow-[0_-8px_24px_rgb(20_26_36/0.08)]">
          <a href={chatUrl} className={`${btnWhatsApp} w-full`} target="_blank" rel="noreferrer">
            {lang === "dholuo" ? uiFill(lang, "whatsapp_name", { name: shop.user.name }) : <>WhatsApp {shop.user.name}</>}
          </a>
          <p className="mt-2 text-center text-sm text-muted">
            <FamilyOrderButton
              variant="link"
              phone={phone}
              subjectName={shop.user.name}
              path={`/b/${shop.slug}`}
              siteName={appName()}
              lang={lang}
            />
          </p>
        </div>
      ) : null}
    </article>
  );
}

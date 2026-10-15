import type { Metadata } from "next";
import Link from "next/link";
import { AdminContactDetails } from "@/components/admin-contact-details";
import { AdminMailTest } from "@/components/admin-mail-test";
import { AgentCountTable } from "@/components/admin-agent-counts";
import { AdminOccasions } from "@/components/admin-occasions";
import { ReasonInput } from "@/components/admin-reason";
import { AdminVideoQueue } from "@/components/admin-video-queue";
import { btnDanger, btnSecondary, fieldClass } from "@/components/ui";
import {
  resolveReport,
  setListingFeatured,
  setListingHidden,
  setListingVerified,
  setOfferingHidden,
  setReviewHidden,
  setServesDiaspora,
  setShopBadge,
  setShopHidden,
  setUserSuspended,
  setVerifiedPro,
} from "@/lib/actions/admin";
import { listingContactHref, userContactHref } from "@/lib/admin-contact";
import { countAgentSignups, knownAgentCodes, resolveAgentRange } from "@/lib/agent-code";
import { auditLabel, MODERATION_NOTICES } from "@/lib/moderation";
import { PRO_DAYS } from "@/lib/constants";
import { PAID_UPGRADES_COMING_SOON, paymentsLive } from "@/lib/payments/live";
import { prisma } from "@/lib/prisma";
import { formatPlanDate, isProActive } from "@/lib/pro";
import {
  DOCUMENTS_SEEN_NOTE,
  SHOP_BADGES,
  SHOP_BADGE_METHODS,
  shopBadgeActionWord,
  shopBadgeDefinition,
  shopBadgeMethodLabel,
} from "@/lib/shop-badges";
import { requireAdmin } from "@/lib/session";
import { stickerScanLabel } from "@/lib/sticker";
import { formatWhen, one } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const notice = params.videoNotice;
  const videoNotice = typeof notice === "string" ? notice : "";
  const moderationCode = one(params.moderation);
  const moderationNotice = MODERATION_NOTICES[moderationCode] ?? "";
  const agentRange = resolveAgentRange({
    agents: one(params.agents),
    from: one(params.agentFrom),
    to: one(params.agentTo),
  });
  const [listings, reports, users, shops, agentUsers, auditLogs, reviews] = await Promise.all([
    prisma.listing.findMany({
      include: { owner: { select: { id: true, name: true, email: true, phone: true, whatsapp: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.report.findMany({
      include: {
        reporter: { select: { name: true, email: true } },
        listing: { select: { id: true, title: true } },
        targetUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        city: true,
        verifiedPro: true,
        verifiedProUntil: true,
        kind: true,
        suspended: true,
        suspendedReason: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.storefront.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            whatsapp: true,
            city: true,
            verifiedPro: true,
            verifiedProUntil: true,
            suspended: true,
          },
        },
        offerings: {
          where: { archived: false },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, title: true, hidden: true, hiddenReason: true },
        },
        badgeEvents: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.user.findMany({
      select: {
        referralAgentCode: true,
        referralAgentAt: true,
        createdAt: true,
        suspended: true,
        storefront: {
          select: {
            id: true,
            published: true,
            hidden: true,
            _count: { select: { offerings: { where: { archived: false } } } },
          },
        },
        _count: { select: { listings: true } },
      },
    }),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        author: { select: { name: true, email: true } },
        listing: { select: { id: true, title: true } },
      },
    }),
  ]);
  const knownCodes = knownAgentCodes();
  const agentCounts = countAgentSignups(
    agentUsers.map((person) => ({
      code: person.referralAgentCode,
      at: person.referralAgentAt ?? person.createdAt,
      hasShop: person.storefront !== null,
      hasPublishedShop: Boolean(
        person.storefront?.published && !person.storefront.hidden && !person.suspended,
      ),
      hasOffering: (person.storefront?._count.offerings ?? 0) > 0,
      hasListing: person._count.listings > 0,
    })),
    { knownCodes, from: agentRange.from, to: agentRange.to },
  );

  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const ordered = [...listings].sort((a, b) => (rank[a.scamRisk] ?? 3) - (rank[b.scamRisk] ?? 3));

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Moderation</h1>
        <p className="mt-1 text-sm text-ink/70">
          Hide listings, shops, offerings, and reviews, and suspend an account. Nothing here is deleted. A suspended
          account cannot sign in, and their shops and listings stay off public pages until you unsuspend them. Shop
          checks (phone, location, business) are granted here. Pro plan is paid on Promote for {PRO_DAYS} days and does
          not verify a shop. Granting it here adds {PRO_DAYS} days. Featured is a directory boost. The listing verified
          flag is separate from those checks. Each action is written to the audit log.
        </p>
        {moderationNotice ? <p className="mt-3 text-sm font-semibold text-danger">{moderationNotice}</p> : null}
        {paymentsLive() ? null : (
          <p className="mt-2 text-sm font-semibold text-navy">
            {PAID_UPGRADES_COMING_SOON}. Grant, Add {PRO_DAYS} days, and Remove on this page still work.
          </p>
        )}
        <p className="mt-3 text-sm">
          <Link href="/admin/ai" className="font-semibold text-lake-dark underline">
            AI usage
          </Link>
          <span className="text-ink/40"> · </span>
          <Link href="/admin/ai/flags" className="font-semibold text-lake-dark underline">
            AI flags
          </Link>
          <span className="text-ink/40"> · </span>
          <Link href="/admin/phones" className="font-semibold text-lake-dark underline">
            Phone numbers
          </Link>
          <span className="text-ink/40"> · </span>
          <Link href="/admin/send-home" className="font-semibold text-lake-dark underline">
            Send-home waitlist
          </Link>
          <span className="text-ink/40"> · </span>
          <Link href="/admin/business" className="font-semibold text-lake-dark underline">
            Business sign-ups
          </Link>
        </p>
      </div>

      <section id="mail" className="grid gap-3">
        <h2 className="font-serif text-2xl">Mail</h2>
        <p className="text-sm text-ink/70">
          Password reset uses ZeptoMail. If a reset sends nothing, this shows the endpoint, the HTTP status, and the
          response body.
        </p>
        <AdminMailTest />
      </section>

      <section id="audit-log" className="grid gap-3">
        <h2 className="font-serif text-2xl">Recent admin actions</h2>
        {auditLogs.length === 0 ? <p className="text-sm text-ink/70">No admin actions yet.</p> : null}
        <ol className="grid gap-2">
          {auditLogs.map((event) => (
            <li key={event.id} className="rounded-xl border border-sand bg-card px-3 py-2 text-sm">
              <p>
                <time dateTime={event.createdAt.toISOString()}>{formatWhen(event.createdAt)}</time>
                {" · "}
                {auditLabel(event.action)} · {event.targetType} {event.targetId} · {event.actorName || "Admin"}
                {event.actorEmail ? ` (${event.actorEmail})` : ""}
              </p>
              {event.reason ? <p className="mt-1 text-ink/75">{event.reason}</p> : null}
            </li>
          ))}
        </ol>
      </section>

      <AdminVideoQueue notice={videoNotice} />

      <AgentCountTable rows={agentCounts} range={agentRange} />

      <section id="shop-badges" className="grid gap-3">
        <h2 className="font-serif text-2xl">Shop checks</h2>
        <p className="text-sm text-ink/70">
          Grant or remove each badge on its own. A grant needs a method: Call, Video, Visit, or Documents seen. A note is
          optional. {DOCUMENTS_SEEN_NOTE}
        </p>
        {shops.length === 0 ? <p className="text-sm text-ink/70">No shops yet.</p> : null}
        {shops.map((shop) => (
          <article key={shop.id} className="grid gap-4 rounded-2xl border border-sand bg-card p-4 text-sm">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/b/${shop.slug}`} className="font-semibold">
                  {shop.user.name}
                </Link>
                <span className="text-ink/60">
                  {shop.hidden ? "Taken down" : shop.published ? "Published" : "Draft"}
                  {shop.user.suspended ? " · owner suspended" : ""}
                </span>
              </div>
              <p className="mt-1 text-sm">
                <Link href={`/b/${shop.slug}/sticker`} className="font-semibold text-lake-dark">
                  Print sticker
                </Link>
                <span className="text-ink/60"> · {stickerScanLabel(shop.stickerScans)}</span>
              </p>
              <div className="mt-3">
                <AdminContactDetails
                  owner={{ email: shop.user.email, phone: shop.user.phone, whatsapp: shop.user.whatsapp }}
                  editHref={userContactHref(shop.user.id)}
                />
              </div>
              <p className="text-ink/70">
                /b/{shop.slug} · {shop.user.city} · {shop.user.email}
                {isProActive(shop.user)
                  ? ` · Pro plan${shop.user.verifiedProUntil ? ` until ${formatPlanDate(shop.user.verifiedProUntil)}` : ""} (paid, not a shop check)`
                  : shop.user.verifiedProUntil
                    ? ` · Pro plan ended ${formatPlanDate(shop.user.verifiedProUntil)} (not a shop check)`
                    : ""}
              </p>
              <form action={setShopHidden} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="storefrontId" value={shop.id} />
                <input type="hidden" name="hidden" value={shop.hidden ? "0" : "1"} />
                <ReasonInput id={`${shop.id}-shop-reason`} />
                <button className={shop.hidden ? btnSecondary : btnDanger} type="submit">
                  {shop.hidden ? "Restore shop" : "Take down shop"}
                </button>
              </form>
              {shop.hiddenReason ? <p className="text-ink/70">Last takedown: {shop.hiddenReason}</p> : null}
              {shop.offerings.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {shop.offerings.map((offering) => (
                    <li key={offering.id} className="rounded-xl border border-sand bg-white p-3">
                      <p className="font-semibold">
                        {offering.title}{" "}
                        <span className="font-normal text-ink/60">{offering.hidden ? "Hidden" : "Visible"}</span>
                      </p>
                      {offering.hiddenReason ? <p className="text-ink/70">{offering.hiddenReason}</p> : null}
                      <form action={setOfferingHidden} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="offeringId" value={offering.id} />
                        <input type="hidden" name="hidden" value={offering.hidden ? "0" : "1"} />
                        <ReasonInput id={`${offering.id}-reason`} />
                        <button className={offering.hidden ? btnSecondary : btnDanger} type="submit">
                          {offering.hidden ? "Restore offering" : "Hide offering"}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-ink/60">No offerings yet.</p>
              )}
              <form action={setServesDiaspora} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="storefrontId" value={shop.id} />
                <input type="hidden" name="value" value={shop.servesDiaspora ? "0" : "1"} />
                <span className={shop.servesDiaspora ? "font-semibold text-lake-dark" : "text-ink/60"}>
                  {shop.servesDiaspora ? "Serves diaspora orders" : "Does not serve diaspora orders"}
                </span>
                <button className={btnSecondary} type="submit">
                  {shop.servesDiaspora ? "Turn off" : "Turn on"}
                </button>
              </form>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {SHOP_BADGES.map((badge) => {
                const on = shop[badge.field];
                const noteId = `${shop.id}-${badge.key}-note`;
                const methodId = `${shop.id}-${badge.key}-method`;
                return (
                  <form key={badge.key} action={setShopBadge} className="grid gap-2 rounded-xl border border-sand bg-white p-3">
                    <input type="hidden" name="storefrontId" value={shop.id} />
                    <input type="hidden" name="badge" value={badge.key} />
                    <input type="hidden" name="action" value={on ? "remove" : "grant"} />
                    <p className="font-semibold">{badge.label}</p>
                    <p className="text-ink/70">{badge.explanation}</p>
                    <p className={on ? "font-semibold text-lake-dark" : "text-ink/55"}>{on ? "Granted" : "Not granted"}</p>
                    {on ? null : (
                      <label htmlFor={methodId} className="text-ink/80">
                        How you checked
                        <select id={methodId} name="method" required defaultValue="" className={fieldClass}>
                          <option value="" disabled>
                            Choose one
                          </option>
                          {SHOP_BADGE_METHODS.map((method) => (
                            <option key={method.key} value={method.key}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label htmlFor={noteId} className="text-ink/80">
                      Note <span className="font-normal text-ink/50">(optional)</span>
                      <input
                        id={noteId}
                        name="note"
                        maxLength={280}
                        placeholder="Why you are granting or removing this"
                        className={fieldClass}
                      />
                    </label>
                    <button className={btnSecondary} type="submit">
                      {on ? `Remove ${badge.label.toLowerCase()}` : `Grant ${badge.label.toLowerCase()}`}
                    </button>
                  </form>
                );
              })}
            </div>
            <div className="grid gap-2">
              <h3 className="font-semibold">Audit trail</h3>
              {shop.badgeEvents.length === 0 ? <p className="text-ink/60">No badge changes yet.</p> : null}
              <ol className="grid gap-2">
                {shop.badgeEvents.map((event) => {
                  const defined = shopBadgeDefinition(event.badge);
                  const when = event.createdAt.toLocaleString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  });
                  const method = event.action === "grant" ? shopBadgeMethodLabel(event.method) : "";
                  return (
                    <li key={event.id} className="rounded-xl bg-paper px-3 py-2">
                      <p>
                        <time dateTime={event.createdAt.toISOString()}>{when}</time>
                        {" · "}
                        {defined?.label ?? event.badge} {shopBadgeActionWord(event.action)}
                        {method ? ` · ${method}` : ""} by {event.adminName || "Admin"}
                        {event.adminEmail ? ` (${event.adminEmail})` : ""}
                      </p>
                      {event.note ? <p className="mt-1 text-ink/75">{event.note}</p> : null}
                      {event.method === "documents" ? <p className="mt-1 text-ink/60">{DOCUMENTS_SEEN_NOTE}</p> : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          </article>
        ))}
      </section>

      <AdminOccasions />

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Reports</h2>
        {reports.length === 0 ? <p className="text-sm text-ink/70">No reports.</p> : null}
        {reports.map((report) => (
          <article key={report.id} className="rounded-2xl border border-sand bg-card p-4 text-sm">
            <p className="font-semibold">
              {report.reason} · {report.status}
            </p>
            <p className="mt-1 text-ink/70">
              From {report.reporter.name} ({report.reporter.email}) · {formatWhen(report.createdAt)}
            </p>
            {report.listing ? (
              <p>
                Listing:{" "}
                <Link href={`/listings/${report.listing.id}`} className="font-semibold text-lake-dark">
                  {report.listing.title}
                </Link>
              </p>
            ) : null}
            {report.targetUser ? (
              <p>
                Person:{" "}
                <Link href={`/people/${report.targetUser.id}`} className="font-semibold text-lake-dark">
                  {report.targetUser.name}
                </Link>
              </p>
            ) : null}
            {report.details ? <p className="mt-2 whitespace-pre-wrap">{report.details}</p> : null}
            {report.status === "open" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={resolveReport}>
                  <input type="hidden" name="id" value={report.id} />
                  <input type="hidden" name="status" value="dismissed" />
                  <button className={btnSecondary}>Dismiss</button>
                </form>
                {report.listingId ? (
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={report.id} />
                    <input type="hidden" name="status" value="actioned" />
                    <input type="hidden" name="hide" value="1" />
                    <button className={btnDanger}>Hide listing and close</button>
                  </form>
                ) : (
                  <form action={resolveReport}>
                    <input type="hidden" name="id" value={report.id} />
                    <input type="hidden" name="status" value="actioned" />
                    <button className={btnSecondary}>Mark actioned</button>
                  </form>
                )}
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Reviews</h2>
        <p className="text-sm text-ink/70">The latest reviews. Hiding one removes it from the listing, the shop, and the rating.</p>
        {reviews.length === 0 ? <p className="text-sm text-ink/70">No reviews.</p> : null}
        {reviews.map((review) => (
          <article key={review.id} className="rounded-2xl border border-sand bg-card p-4 text-sm">
            <p className="font-semibold">
              {review.rating} / 5 · {review.author.name} · {review.hidden ? "Hidden" : "Visible"}
            </p>
            <p className="text-ink/70">
              {review.author.email} · {formatWhen(review.createdAt)}
              {review.listing ? (
                <>
                  {" · "}
                  <Link href={`/listings/${review.listing.id}`} className="font-semibold text-lake-dark">
                    {review.listing.title}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{review.body}</p>
            {review.hiddenReason ? <p className="mt-1 text-ink/70">{review.hiddenReason}</p> : null}
            <form action={setReviewHidden} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="reviewId" value={review.id} />
              <input type="hidden" name="hidden" value={review.hidden ? "0" : "1"} />
              <ReasonInput id={`${review.id}-reason`} />
              <button className={review.hidden ? btnSecondary : btnDanger} type="submit">
                {review.hidden ? "Restore review" : "Hide review"}
              </button>
            </form>
          </article>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Listings</h2>
        <p className="text-sm text-ink/70">This verified flag marks the directory listing. It is separate from shop checks.</p>
        {ordered.map((listing) => (
          <article key={listing.id} className="rounded-2xl border border-sand bg-card p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/listings/${listing.id}`} className="font-semibold">
                {listing.title}
              </Link>
              <span className="text-ink/60">{listing.hidden ? "Hidden" : "Visible"}</span>
            </div>
            <p className="text-ink/70">
              {listing.city} · {listing.type} · {listing.owner.name} · risk {listing.scamRisk}
              {listing.verified ? " · verified" : ""}
            </p>
            {listing.scamNotes ? <p className="mt-1">{listing.scamNotes}</p> : null}
            {listing.hiddenReason ? <p className="mt-1 text-ink/70">{listing.hiddenReason}</p> : null}
            <div className="mt-3">
              <AdminContactDetails
                owner={{
                  email: listing.owner.email,
                  phone: listing.owner.phone,
                  whatsapp: listing.owner.whatsapp,
                }}
                listing={{
                  contactName: listing.contactName,
                  contactPhone: listing.contactPhone,
                  contactWhatsapp: listing.contactWhatsapp,
                }}
                editHref={listingContactHref(listing.id)}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <form action={setListingHidden} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="hidden" value={listing.hidden ? "0" : "1"} />
                <ReasonInput id={`${listing.id}-hide-reason`} />
                <button className={listing.hidden ? btnSecondary : btnDanger} type="submit">
                  {listing.hidden ? "Unhide" : "Hide"}
                </button>
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
          </article>
        ))}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">People</h2>
        <p className="text-sm text-ink/70">
          Grant Pro plan adds {PRO_DAYS} days, or adds {PRO_DAYS} days onto a plan that is still running. Remove turns it
          off. Phone, Location, and Business verified are not changed.
        </p>
        {users.map((person) => {
          const proOn = isProActive(person);
          const proNote = proOn
            ? person.verifiedProUntil
              ? ` · Pro plan until ${formatPlanDate(person.verifiedProUntil)}`
              : " · Pro plan"
            : person.verifiedProUntil
              ? ` · Pro plan ended ${formatPlanDate(person.verifiedProUntil)}`
              : "";
          return (
            <article key={person.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand bg-card p-4 text-sm">
              <div>
                <Link href={`/people/${person.id}`} className="font-semibold">
                  {person.name}
                </Link>
                {person.suspended ? <span className="ml-2 text-danger">Suspended</span> : null}
                <p className="text-ink/70">
                  {person.email} · {person.kind} · {person.city}
                  {person.role === "admin" ? " · admin" : ""}
                  {proNote}
                  {person.suspendedReason ? ` · ${person.suspendedReason}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {person.id === admin.id ? null : (
                  <form action={setUserSuspended} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="userId" value={person.id} />
                    <input type="hidden" name="suspended" value={person.suspended ? "0" : "1"} />
                    <ReasonInput id={`${person.id}-suspend-reason`} />
                    <button className={person.suspended ? btnSecondary : btnDanger} type="submit">
                      {person.suspended ? "Unsuspend" : "Suspend"}
                    </button>
                  </form>
                )}
                <form action={setVerifiedPro}>
                  <input type="hidden" name="userId" value={person.id} />
                  <input type="hidden" name="value" value="1" />
                  <button className={btnSecondary}>{proOn ? `Add ${PRO_DAYS} days` : "Grant Pro plan"}</button>
                </form>
                {person.verifiedPro || person.verifiedProUntil ? (
                  <form action={setVerifiedPro}>
                    <input type="hidden" name="userId" value={person.id} />
                    <input type="hidden" name="value" value="0" />
                    <button className={btnSecondary}>Remove Pro plan</button>
                  </form>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

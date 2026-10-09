import type { Metadata } from "next";
import Link from "next/link";
import { AgentCountTable } from "@/components/admin-agent-counts";
import { AdminOccasions } from "@/components/admin-occasions";
import { AdminVideoQueue } from "@/components/admin-video-queue";
import { btnDanger, btnSecondary, fieldClass } from "@/components/ui";
import {
  resolveReport,
  setListingHidden,
  setListingVerified,
  setServesDiaspora,
  setShopBadge,
  setVerifiedPro,
} from "@/lib/actions/admin";
import { countAgentSignups } from "@/lib/agent-code";
import { PRO_DAYS } from "@/lib/constants";
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
import { formatWhen } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const notice = (await searchParams).videoNotice;
  const videoNotice = typeof notice === "string" ? notice : "";
  const [listings, reports, users, shops, agentUsers] = await Promise.all([
    prisma.listing.findMany({
      include: { owner: { select: { name: true, email: true } } },
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
      },
      orderBy: { name: "asc" },
    }),
    prisma.storefront.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, city: true, verifiedPro: true, verifiedProUntil: true } },
        badgeEvents: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.user.findMany({
      select: {
        referralAgentCode: true,
        storefront: { select: { id: true } },
        _count: { select: { listings: true } },
      },
    }),
  ]);
  const agentCounts = countAgentSignups(
    agentUsers.map((person) => ({
      code: person.referralAgentCode,
      hasShop: person.storefront !== null,
      hasListing: person._count.listings > 0,
    })),
  );

  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const ordered = [...listings].sort((a, b) => (rank[a.scamRisk] ?? 3) - (rank[b.scamRisk] ?? 3));

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Moderation</h1>
        <p className="mt-1 text-sm text-ink/70">
          Hide listings and close reports. Shop checks (phone, location, business) are granted here, and each change is
          kept in the audit trail. Pro plan is paid on Promote for {PRO_DAYS} days and does not verify a shop. Granting
          it here adds {PRO_DAYS} days. The listing verified flag is separate from those checks.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin/ai" className="font-semibold text-lake-dark underline">
            AI usage
          </Link>
          <span className="text-ink/40"> · </span>
          <Link href="/admin/ai/flags" className="font-semibold text-lake-dark underline">
            AI flags
          </Link>
        </p>
      </div>

      <AdminVideoQueue notice={videoNotice} />

      <AgentCountTable rows={agentCounts} />

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
                <span className="text-ink/60">{shop.published ? "Published" : "Draft"}</span>
              </div>
              <p className="text-ink/70">
                /b/{shop.slug} · {shop.user.city} · {shop.user.email}
                {isProActive(shop.user)
                  ? ` · Pro plan${shop.user.verifiedProUntil ? ` until ${formatPlanDate(shop.user.verifiedProUntil)}` : ""} (paid, not a shop check)`
                  : shop.user.verifiedProUntil
                    ? ` · Pro plan ended ${formatPlanDate(shop.user.verifiedProUntil)} (not a shop check)`
                    : ""}
              </p>
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
            <div className="mt-3 flex flex-wrap gap-2">
              <form action={setListingHidden}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="hidden" value={listing.hidden ? "0" : "1"} />
                <button className={btnSecondary}>{listing.hidden ? "Unhide" : "Hide"}</button>
              </form>
              <form action={setListingVerified}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="verified" value={listing.verified ? "0" : "1"} />
                <button className={btnSecondary}>{listing.verified ? "Remove verified" : "Grant verified"}</button>
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
                <p className="text-ink/70">
                  {person.email} · {person.kind} · {person.city}
                  {person.role === "admin" ? " · admin" : ""}
                  {proNote}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
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

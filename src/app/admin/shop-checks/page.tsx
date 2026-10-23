import type { Metadata } from "next";
import Link from "next/link";
import { AdminContactDetails } from "@/components/admin-contact-details";
import { ReasonInput } from "@/components/admin-reason";
import { AdminVideoQueue } from "@/components/admin-video-queue";
import { btnDanger, btnSecondary, fieldClass } from "@/components/ui";
import { setOfferingHidden, setServesDiaspora, setShopBadge, setShopHidden } from "@/lib/actions/admin";
import { userContactHref } from "@/lib/admin-contact";
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

export const metadata: Metadata = { title: "Shop checks" };

export default async function AdminShopChecksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/shop-checks");
  const params = await searchParams;
  const notice = params.videoNotice;
  const videoNotice = typeof notice === "string" ? notice : "";
  const shops = await prisma.storefront.findMany({
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
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
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

      <AdminVideoQueue notice={videoNotice} />
    </div>
  );
}

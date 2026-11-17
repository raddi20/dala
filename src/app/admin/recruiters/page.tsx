import type { Metadata } from "next";
import Link from "next/link";
import { addShopRecruiter, updateShopRecruiter } from "@/app/admin/recruiters/actions";
import { CopyTextButton } from "@/components/copy-text-button";
import { StickerQr } from "@/components/sticker-sheet";
import { btnPrimary, btnSecondary, fieldClass, labelClass } from "@/components/ui";
import { RECRUITER_QR_PNG_PX } from "@/lib/recruiter-qr";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { countReferredShops, recruiterShortUrl, recruiterSignupUrl, referredShopStatus } from "@/lib/recruiter";
import { requireAdmin } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Recruiters" };

const NOTICES: Record<string, string> = {
  added: "Recruiter added.",
  saved: "Saved.",
  format: "Use 2–32 letters, numbers, or hyphens.",
  name: "Enter a name (2–80 characters).",
  active: "Choose active or inactive.",
  taken: "That code is already in use.",
  missing: "That recruiter is no longer there.",
};

function nairobiDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  });
}

export default async function AdminRecruitersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/recruiters");
  const params = await searchParams;
  const notice = NOTICES[one(params.notice)] ?? "";
  const origin = await publicOrigin();
  const [recruiters, shops] = await Promise.all([
    prisma.recruiter.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.storefront.findMany({
      where: { recruiterCode: { not: null } },
      select: {
        id: true,
        slug: true,
        recruiterCode: true,
        createdAt: true,
        published: true,
        hidden: true,
        user: { select: { name: true, suspended: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
      <div>
        <p className="text-sm">
          <Link href="/admin" className="font-semibold text-lake-dark underline">
            Admin
          </Link>
        </p>
        <h1 className="mt-2 font-serif text-3xl">Recruiters</h1>
        <p className="mt-2 text-sm text-ink/70">
          Each recruiter has a link for new shops. A shop is counted only when that code was active at the moment the
          shop was opened. An unknown code, an inactive code, or no code leaves the shop with no recruiter, and the shop
          still opens. A code already saved on a shop is not changed later. This week is Monday to Sunday, Africa/Nairobi.
        </p>
        {notice ? <p className="mt-3 text-sm font-semibold text-navy">{notice}</p> : null}
      </div>

      <form action={addShopRecruiter} className="grid gap-3 rounded-2xl border border-sand bg-card p-4 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <label className={labelClass}>
          Code
          <input name="code" required minLength={2} maxLength={32} placeholder="irene" autoCapitalize="none" className={fieldClass} />
        </label>
        <label className={labelClass}>
          Name
          <input name="name" required minLength={2} maxLength={80} placeholder="Irene" className={fieldClass} />
        </label>
        <button type="submit" className={btnPrimary}>
          Add recruiter
        </button>
      </form>

      {recruiters.length === 0 ? <p className="text-sm text-ink/70">No recruiters yet.</p> : null}

      <ul className="grid gap-4">
        {recruiters.map((recruiter) => {
          const link = recruiterShortUrl(origin, recruiter.code);
          const longLink = recruiterSignupUrl(origin, recruiter.code);
          const rows = shops.filter((shop) => shop.recruiterCode === recruiter.code);
          const counts = countReferredShops(rows.map((shop) => shop.createdAt));
          const png = `/admin/recruiters/${recruiter.code}/qr?px=${RECRUITER_QR_PNG_PX}&download=1`;
          return (
            <li key={recruiter.id} className="grid gap-4 rounded-2xl border border-sand bg-card p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-serif text-2xl text-navy">{recruiter.name}</h2>
                <p className="text-ink/60">{recruiter.active ? "Active" : "Inactive"}</p>
              </div>

              <p className="grid grid-cols-2 gap-3">
                <span>
                  <span className="block text-ink/60">This week</span>
                  <span className="font-serif text-2xl text-navy">{counts.thisWeek}</span>
                </span>
                <span>
                  <span className="block text-ink/60">All time</span>
                  <span className="font-serif text-2xl text-navy">{counts.allTime}</span>
                </span>
              </p>

              <div className="grid gap-2">
                <p className="flex flex-wrap items-center gap-2">
                  <a href={link} className="break-all font-semibold text-lake-dark">
                    {link}
                  </a>
                  <CopyTextButton text={link} />
                </p>
                <p className="break-all text-ink/55">Longer link: {longLink}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
                <StickerQr url={link} className="h-40 w-40 max-w-full bg-white" />
                <div className="flex flex-wrap gap-2">
                  <a href={png} className={btnSecondary}>
                    Download PNG
                  </a>
                  <Link href={`/admin/recruiters/${recruiter.code}/print`} className={btnSecondary}>
                    Print large QR
                  </Link>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-navy">Shops from this link</h3>
                {rows.length === 0 ? <p className="mt-1 text-ink/60">No shops from this link yet.</p> : null}
                <ul className="mt-2 grid gap-2">
                  {rows.map((shop) => (
                    <li key={shop.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <Link href={`/admin/shop-checks#shop-${shop.id}`} className="font-semibold text-lake-dark underline">
                        {shop.user.name}
                      </Link>
                      <span className="text-ink/60">
                        <time dateTime={shop.createdAt.toISOString()}>{nairobiDate(shop.createdAt)}</time>
                        {" · "}
                        {referredShopStatus(shop)}
                        {shop.user.suspended ? " · owner suspended" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <form action={updateShopRecruiter} className="grid gap-3 border-t border-sand pt-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                <input type="hidden" name="id" value={recruiter.id} />
                <label className={labelClass}>
                  Name
                  <input name="name" required minLength={2} maxLength={80} defaultValue={recruiter.name} className={fieldClass} />
                </label>
                <label className={labelClass}>
                  Status
                  <select name="active" defaultValue={recruiter.active ? "yes" : "no"} className={fieldClass}>
                    <option value="yes">Active</option>
                    <option value="no">Inactive</option>
                  </select>
                </label>
                <button type="submit" className={btnPrimary}>
                  Save
                </button>
              </form>
              <p className="text-ink/50">Code {recruiter.code} stays on the short link and the QR.</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

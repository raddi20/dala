import type { Metadata } from "next";
import Link from "next/link";
import { setSendHomePilot } from "@/app/admin/send-home/actions";
import { btnSecondary } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { countLabels } from "@/lib/send-home";
import { requireAdmin } from "@/lib/session";
import { formatWhen, one } from "@/lib/utils";

export const metadata: Metadata = { title: "Send-home waitlist" };

const NOTICES: Record<string, string> = {
  saved: "Saved.",
  missing: "That shop is no longer there.",
};

export default async function AdminSendHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/send-home");
  const notice = NOTICES[one((await searchParams).notice)] ?? "";
  const [rows, shops] = await Promise.all([
    prisma.diasporaWaitlist.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.storefront.findMany({
      orderBy: { user: { name: "asc" } },
      select: {
        id: true,
        slug: true,
        published: true,
        hidden: true,
        sendHomePilot: true,
        user: { select: { name: true, city: true, suspended: true } },
      },
    }),
  ]);
  const byCountry = countLabels(rows.map((row) => ({ label: row.country })));
  const byArea = countLabels(rows.map((row) => ({ label: row.homeArea })));

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <div>
        <p className="text-sm">
          <Link href="/admin" className="font-semibold text-lake-dark underline">
            Admin
          </Link>
        </p>
        <h1 className="mt-2 font-serif text-3xl">Send-home waitlist</h1>
        <p className="mt-2 text-sm text-ink/70">
          People who asked to hear when a basket can be sent home. There is no card order on this list. Turning a pilot
          shop on or off is written to the audit log.
        </p>
        {notice ? <p className="mt-3 text-sm font-semibold text-navy">{notice}</p> : null}
        <p className="mt-3 text-sm">
          <a href="/admin/send-home/export" className="font-semibold text-lake-dark underline">
            Download CSV
          </a>
          <span className="text-ink/40"> · </span>
          <Link href="/send-home" className="font-semibold text-lake-dark underline">
            Public page
          </Link>
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <CountList title="By country" rows={byCountry} />
        <CountList title="By home area" rows={byArea} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Pilot shops</h2>
        {shops.length === 0 ? <p className="text-sm text-ink/70">No shops yet.</p> : null}
        <ul className="grid gap-2">
          {shops.map((shop) => (
            <li key={shop.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sand bg-card px-3 py-2 text-sm">
              <div>
                <Link href={`/b/${shop.slug}`} className="font-semibold">
                  {shop.user.name}
                </Link>
                <p className="text-ink/60">
                  {shop.user.city}
                  {shop.published && !shop.hidden && !shop.user.suspended ? "" : " · not on the public page"}
                  {shop.sendHomePilot ? " · pilot" : ""}
                </p>
              </div>
              <form action={setSendHomePilot}>
                <input type="hidden" name="id" value={shop.id} />
                <input type="hidden" name="on" value={shop.sendHomePilot ? "0" : "1"} />
                <button type="submit" className={btnSecondary}>
                  {shop.sendHomePilot ? "Turn pilot off" : "Turn pilot on"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Sign-ups ({rows.length})</h2>
        {rows.length === 0 ? <p className="text-sm text-ink/70">No one on the waitlist yet.</p> : null}
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-sand bg-card px-3 py-2 text-sm">
              <p className="font-semibold text-navy">{row.name}</p>
              <p>
                {row.email}
                {row.whatsapp ? ` · ${row.whatsapp}` : ""}
              </p>
              <p className="text-ink/70">
                {row.country} · {row.homeArea} · {row.baskets.replaceAll(",", ", ")}
              </p>
              <p className="text-ink/60">{formatWhen(row.createdAt)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CountList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div className="rounded-2xl border border-sand bg-card p-4">
      <h2 className="font-serif text-xl text-navy">{title}</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-ink/70">None yet.</p> : null}
      <ul className="mt-2 grid gap-1 text-sm">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between gap-3">
            <span>{row.label}</span>
            <span className="font-semibold text-navy">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

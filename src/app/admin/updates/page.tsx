import type { Metadata } from "next";
import Link from "next/link";
import { reviewShopUpdate, setUpdatesPaused } from "@/lib/actions/community";
import { DigestLetter } from "@/components/digest-letter";
import { btnDanger, btnNavy, btnSecondary, fieldClass } from "@/components/ui";
import { digestEmailText } from "@/lib/community/digest";
import { MODERATION_NOTICES } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatWhen, one } from "@/lib/utils";

export const metadata: Metadata = { title: "Shop updates" };

const SAMPLE = digestEmailText({
  name: "Achieng",
  origin: "https://www.rangach.co.ke",
  unsubscribe: "https://www.rangach.co.ke/api/community/digest-unsubscribe?user=example&token=sample",
  shops: [
    {
      name: "Nyangoma Fresh Fish",
      slug: "nyangoma-fish",
      ownerEmail: "nyangoma@example.com",
      updates: [{ body: "Omena is in. Come by before noon.", createdAt: new Date() }],
      listings: [{ id: "sample", title: "Whole tilapia, this morning", createdAt: new Date() }],
    },
  ],
});

export default async function AdminUpdatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/updates");
  const notice = MODERATION_NOTICES[one((await searchParams).notice)] ?? "";
  const [pause, held] = await Promise.all([
    prisma.communitySetting.findUnique({ where: { id: "default" } }),
    prisma.shopUpdate.findMany({
      where: { status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { storefront: { select: { slug: true, user: { select: { name: true, email: true } } } } },
    }),
  ]);
  const paused = pause?.updatesPaused ?? false;

  return (
    <div className="mx-auto grid min-w-0 max-w-3xl gap-8 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl text-navy">Shop updates</h1>
        <p className="mt-2 text-sm text-ink/70">
          Notes held back from the shop page. Approve to show one, or reject or remove it. Each choice is written to the
          audit log.
        </p>
        {notice ? (
          <p className="mt-3 text-sm font-semibold text-danger" role="alert">
            {notice}
          </p>
        ) : null}
      </div>

      <section className="grid gap-3 rounded-[14px] border border-line bg-card p-4">
        <h2 className="font-serif text-2xl text-navy">Posting</h2>
        <p className="text-sm text-ink/80">{paused ? "Posting is paused." : "Shops can post."}</p>
        <form action={setUpdatesPaused} className="grid gap-3">
          <input type="hidden" name="paused" value={paused ? "0" : "1"} />
          <label className="block text-sm">
            Note for sellers
            <input name="note" defaultValue={pause?.pauseNote ?? ""} maxLength={200} className={fieldClass} />
          </label>
          <label className="block text-sm">
            Reason
            <input name="reason" maxLength={500} className={fieldClass} placeholder="Why you are changing this" />
          </label>
          <button type="submit" className={paused ? btnNavy : btnSecondary}>{paused ? "Allow posting" : "Pause posting"}</button>
        </form>
      </section>

      <section className="grid gap-3" data-update-queue="">
        <h2 className="font-serif text-2xl text-navy">Waiting</h2>
        {held.length === 0 ? <p className="text-sm text-ink/70">Nothing is waiting.</p> : null}
        {held.map((update) => (
          <article key={update.id} className="grid min-w-0 gap-3 rounded-[14px] border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold-d">
              Held · {formatWhen(update.createdAt)}
            </p>
            <p className="text-sm">
              <Link href={`/b/${update.storefront.slug}`} className="font-semibold text-navy">
                {update.storefront.user.name}
              </Link>
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{update.body}</p>
            {update.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={update.photoUrl} alt="" className="max-h-48 w-full rounded-xl object-cover" />
            ) : null}
            {update.holdReason ? <p className="text-sm text-ink/70">{update.holdReason}</p> : null}
            <form action={reviewShopUpdate} className="grid gap-3">
              <input type="hidden" name="id" value={update.id} />
              <label className="block text-sm">
                Reason
                <input name="reason" maxLength={500} className={fieldClass} placeholder="What you decided" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="decision" value="approve" className={btnNavy}>
                  Approve
                </button>
                <button type="submit" name="decision" value="reject" className={btnSecondary}>
                  Reject
                </button>
                <button type="submit" name="decision" value="remove" className={btnDanger}>
                  Remove
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>

      <section className="grid min-w-0 gap-3">
        <h2 className="font-serif text-2xl text-navy">Monday note</h2>
        <p className="text-sm text-ink/70">A sample of the email. Nothing is sent from this page.</p>
        <DigestLetter text={SAMPLE} />
      </section>
    </div>
  );
}

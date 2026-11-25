import { formatWhen } from "@/lib/utils";
import { UpdateReport } from "@/components/update-report";

export type PublicUpdate = {
  id: string;
  body: string;
  photoUrl: string;
  createdAt: Date;
};

/** Newest first. Hidden when the shop has nothing current. */
export function ShopUpdates({
  updates,
  canReport,
}: {
  updates: PublicUpdate[];
  canReport: boolean;
}) {
  if (updates.length === 0) return null;
  return (
    <section id="updates" aria-label="Updates" data-shop-updates="" className="grid min-w-0 gap-2">
      <h2 className="font-serif text-xl text-navy">Updates</h2>
      <ul className="grid min-w-0 gap-2">
        {updates.map((update) => (
          <li key={update.id} className="flex min-w-0 gap-3 rounded-[14px] border border-line/80 bg-card p-3 shadow-[var(--shadow-card)]">
            {update.photoUrl ? (
              // Shop photos are already stored. next/image would need every host.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={update.photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gold-d">{formatWhen(update.createdAt)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-ink">{update.body}</p>
              {canReport ? (
                <div className="mt-1">
                  <UpdateReport id={update.id} />
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

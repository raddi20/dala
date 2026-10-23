import type { Metadata } from "next";
import Link from "next/link";
import { ReasonInput } from "@/components/admin-reason";
import { btnDanger, btnSecondary } from "@/components/ui";
import { setUserSuspended, setVerifiedPro } from "@/lib/actions/admin";
import { PRO_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { formatPlanDate, isProActive } from "@/lib/pro";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "People" };

export default async function AdminPeoplePage() {
  const admin = await requireAdmin("/admin/people");
  const users = await prisma.user.findMany({
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
  });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
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

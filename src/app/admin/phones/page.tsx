import type { Metadata } from "next";
import Link from "next/link";
import { applyPhoneNumbers } from "@/app/admin/phones/actions";
import { btnPrimary } from "@/components/ui";
import { phoneFieldDiffs, planPhoneRow, readPhoneRows, type PhoneFieldDiff } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Phone numbers" };
export const dynamic = "force-dynamic";

function show(value: string) {
  return value.trim() ? value : "(empty)";
}

function DiffList({ diffs, proposed }: { diffs: PhoneFieldDiff[]; proposed: boolean }) {
  if (diffs.length === 0) return <p className="text-sm text-ink/70">None.</p>;
  return (
    <ul className="grid gap-2">
      {diffs.map((diff) => (
        <li key={`${diff.kind}-${diff.id}-${diff.field}`} className="rounded-xl border border-sand bg-card px-3 py-2 text-sm">
          <p className="font-semibold">{diff.record}</p>
          <p className="mt-1">
            <span className="text-ink/60">Field</span> {diff.field}
          </p>
          <p>
            <span className="text-ink/60">Current</span> {show(diff.current)}
          </p>
          {proposed ? (
            <p>
              <span className="text-ink/60">Proposed</span> {show(diff.proposed)}
            </p>
          ) : (
            <p>
              <span className="text-ink/60">Reason</span> {diff.manualReason}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default async function AdminPhonesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/phones");
  const params = await searchParams;
  const appliedRaw = one(params.applied);
  const applied = /^\d+$/.test(appliedRaw) ? Number(appliedRaw) : null;
  const plans = (await readPhoneRows(prisma)).map(planPhoneRow);
  const diffs = plans.flatMap(phoneFieldDiffs);
  const fixes = diffs.filter((diff) => diff.fixable);
  const manual = diffs.filter((diff) => diff.manualReason);
  const fixRows = new Set(fixes.map((diff) => `${diff.kind}:${diff.id}`)).size;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Phone numbers</h1>
        <p className="mt-1 text-sm text-ink/70">
          Dry run of stored phone and WhatsApp numbers. Apply reads the database again and writes only the numbers
          that can be saved as E.164. A number that cannot be read stays as it is. Running apply again changes nothing.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin" className="font-semibold text-lake-dark underline">
            Moderation
          </Link>
        </p>
      </div>

      {applied === null ? null : (
        <p className="rounded-xl border border-sand bg-card px-3 py-2 text-sm" role="status">
          {applied === 0
            ? "Nothing was written. Numbers that need a manual fix were left as they are."
            : `Updated ${applied} ${applied === 1 ? "record" : "records"}.`}
        </p>
      )}

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Would update {fixRows === 1 ? "1 record" : `${fixRows} records`}</h2>
        <DiffList diffs={fixes} proposed />
        {fixes.length > 0 ? (
          <form action={applyPhoneNumbers}>
            <button className={btnPrimary} type="submit">
              Apply E.164 fixes
            </button>
            <p className="mt-2 text-sm text-ink/70">
              Writes the proposed numbers above. Anything under Needs a manual fix is not changed.
            </p>
          </form>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">Needs a manual fix</h2>
        <DiffList diffs={manual} proposed={false} />
      </section>
    </div>
  );
}

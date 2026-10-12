import type { Metadata } from "next";
import Link from "next/link";
import { applyPhoneNumbers } from "@/app/admin/phones/actions";
import { AdminContactDetails, type AdminListingContact, type AdminOwnerContact } from "@/components/admin-contact-details";
import { btnPrimary } from "@/components/ui";
import { listingContactHref, userContactHref } from "@/lib/admin-contact";
import { phoneFieldDiffs, planPhoneRow, readPhoneRows, type PhoneFieldDiff } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { one } from "@/lib/utils";

export const metadata: Metadata = { title: "Phone numbers" };
export const dynamic = "force-dynamic";

function show(value: string) {
  return value.trim() ? value : "(empty)";
}

type FlaggedContact = {
  owner: AdminOwnerContact;
  listing?: AdminListingContact;
  editHref: string;
};

function DiffList({
  diffs,
  proposed,
  contacts,
}: {
  diffs: PhoneFieldDiff[];
  proposed: boolean;
  contacts?: Map<string, FlaggedContact>;
}) {
  if (diffs.length === 0) return <p className="text-sm text-ink/70">None.</p>;
  return (
    <ul className="grid gap-2">
      {diffs.map((diff) => {
        const contact = contacts?.get(`${diff.kind}:${diff.id}`);
        const editHref = contact?.editHref ?? (diff.kind === "listing" ? listingContactHref(diff.id) : userContactHref(diff.id));
        return (
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
            {proposed ? null : (
              <div className="mt-2 grid gap-2">
                <p>
                  <Link href={editHref} className="font-semibold text-lake-dark underline">
                    Edit
                  </Link>
                </p>
                {contact ? <AdminContactDetails owner={contact.owner} listing={contact.listing} /> : null}
              </div>
            )}
          </li>
        );
      })}
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
  const listingIds = [...new Set(manual.filter((diff) => diff.kind === "listing").map((diff) => diff.id))];
  const userIds = [...new Set(manual.filter((diff) => diff.kind === "user").map((diff) => diff.id))];
  const [flaggedListings, flaggedUsers] = await Promise.all([
    listingIds.length
      ? prisma.listing.findMany({
          where: { id: { in: listingIds } },
          select: {
            id: true,
            contactName: true,
            contactPhone: true,
            contactWhatsapp: true,
            owner: { select: { email: true, phone: true, whatsapp: true } },
          },
        })
      : [],
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, phone: true, whatsapp: true },
        })
      : [],
  ]);
  const contacts = new Map<string, FlaggedContact>();
  for (const listing of flaggedListings) {
    contacts.set(`listing:${listing.id}`, {
      owner: listing.owner,
      listing: {
        contactName: listing.contactName,
        contactPhone: listing.contactPhone,
        contactWhatsapp: listing.contactWhatsapp,
      },
      editHref: listingContactHref(listing.id),
    });
  }
  for (const user of flaggedUsers) {
    contacts.set(`user:${user.id}`, {
      owner: { email: user.email, phone: user.phone, whatsapp: user.whatsapp },
      editHref: userContactHref(user.id),
    });
  }

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
        <DiffList diffs={manual} proposed={false} contacts={contacts} />
      </section>
    </div>
  );
}

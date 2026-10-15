import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { updateBusinessLead } from "@/app/admin/business/actions";
import { btnPrimary, fieldClass, labelClass } from "@/components/ui";
import {
  LEAD_STATUSES,
  isLeadStatus,
  leadStatusCounts,
  leadStatusLabel,
} from "@/lib/business-lead";
import { businessTierById } from "@/lib/business-tiers";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { telHref } from "@/lib/phone";
import { formatWhen, one } from "@/lib/utils";

export const metadata: Metadata = { title: "Business leads" };

const NOTICES: Record<string, string> = {
  saved: "Saved.",
  status: "Choose a status.",
  notes: "Notes must be 500 characters or fewer.",
  missing: "That sign-up is no longer there.",
};

export default async function AdminBusinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/business");
  const params = await searchParams;
  const notice = NOTICES[one(params.notice)] ?? "";
  const filter = one(params.status).trim().toLowerCase();
  const activeFilter = isLeadStatus(filter) ? filter : "";
  const leads = await prisma.businessLead.findMany({ orderBy: { createdAt: "desc" } });
  const counts = leadStatusCounts(leads);
  const shown = activeFilter ? leads.filter((lead) => lead.status === activeFilter) : leads;

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8">
      <div>
        <p className="text-sm">
          <Link href="/admin" className="font-semibold text-lake-dark underline">
            Admin
          </Link>
        </p>
        <h1 className="mt-2 font-serif text-3xl">Business sign-ups</h1>
        <p className="mt-2 text-sm text-ink/70">
          Shops that asked about a plan. Billing stays manual. Nothing here takes a card payment. Status and notes are
          written to the audit log.
        </p>
        {notice ? <p className="mt-3 text-sm font-semibold text-navy">{notice}</p> : null}
        <p className="mt-3 text-sm">
          <a href="/admin/business/export" className="font-semibold text-lake-dark underline">
            Download CSV
          </a>
        </p>
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <FilterLink href="/admin/business" current={activeFilter === ""}>
          All ({leads.length})
        </FilterLink>
        {LEAD_STATUSES.map((status) => (
          <FilterLink key={status} href={`/admin/business?status=${status}`} current={activeFilter === status}>
            {leadStatusLabel(status)} ({counts[status]})
          </FilterLink>
        ))}
      </p>

      {shown.length === 0 ? <p className="text-sm text-ink/70">No shop interest yet.</p> : null}
      <ul className="grid gap-4">
        {shown.map((lead) => {
          const phoneLink = telHref(lead.phone);
          const tierName = businessTierById(lead.tier)?.name ?? lead.tier;
          return (
            <li key={lead.id} className="grid gap-3 rounded-2xl border border-sand bg-card p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-navy">{lead.businessName}</p>
                <p className="text-ink/60">
                  {tierName} · {leadStatusLabel(lead.status)} · {formatWhen(lead.createdAt)}
                </p>
              </div>
              <p>
                {lead.contactName}
                {" · "}
                {phoneLink ? (
                  <a href={phoneLink} className="font-semibold text-lake-dark">
                    {lead.phone}
                  </a>
                ) : (
                  lead.phone
                )}
                {" · "}
                {lead.town}
              </p>
              <p className="text-ink/60">
                Ref {lead.refCode || "none"}
                {" · "}
                Agent {lead.agentCode || "none"}
              </p>
              {lead.notes ? <p className="text-ink/80">{lead.notes}</p> : null}
              <form action={updateBusinessLead} className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                <input type="hidden" name="id" value={lead.id} />
                <label className={labelClass}>
                  Status
                  <select name="status" defaultValue={lead.status} className={fieldClass}>
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {leadStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Notes
                  <input name="adminNotes" defaultValue={lead.adminNotes} maxLength={500} className={fieldClass} />
                </label>
                <button type="submit" className={btnPrimary}>
                  Save
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FilterLink({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <Link href={href} className={current ? "font-semibold text-navy" : "text-lake-dark underline"} aria-current={current ? "page" : undefined}>
      {children}
    </Link>
  );
}

import type { Metadata } from "next";
import { auditLabel } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatWhen } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin activity" };

export default async function AdminActivityPage() {
  await requireAdmin("/admin/activity");
  const auditLogs = await prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 40 });

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <section id="audit-log" className="grid gap-3">
        <h2 className="font-serif text-2xl">Recent admin actions</h2>
        {auditLogs.length === 0 ? <p className="text-sm text-ink/70">No admin actions yet.</p> : null}
        <ol className="grid gap-2">
          {auditLogs.map((event) => (
            <li key={event.id} className="rounded-xl border border-sand bg-card px-3 py-2 text-sm">
              <p>
                <time dateTime={event.createdAt.toISOString()}>{formatWhen(event.createdAt)}</time>
                {" · "}
                {auditLabel(event.action)} · {event.targetType} {event.targetId} · {event.actorName || "Admin"}
                {event.actorEmail ? ` (${event.actorEmail})` : ""}
              </p>
              {event.reason ? <p className="mt-1 text-ink/75">{event.reason}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

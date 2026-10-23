import type { Metadata } from "next";
import { AdminMailTest } from "@/components/admin-mail-test";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Mail" };

export default async function AdminMailPage() {
  await requireAdmin("/admin/mail");

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8">
      <section id="mail" className="grid gap-3">
        <h2 className="font-serif text-2xl">Mail</h2>
        <p className="text-sm text-ink/70">
          Password reset uses ZeptoMail. If a reset sends nothing, this shows the endpoint, the HTTP status, and the
          response body.
        </p>
        <AdminMailTest />
      </section>
    </div>
  );
}

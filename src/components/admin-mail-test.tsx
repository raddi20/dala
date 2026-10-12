"use client";

import { useActionState } from "react";
import { sendAdminTestEmail } from "@/lib/actions/admin-mail";
import { btnPrimary } from "@/components/ui";
import type { MailDelivery } from "@/lib/email/zeptomail";

export function AdminMailTest() {
  const [state, action, pending] = useActionState(sendAdminTestEmail, null as MailDelivery | null);
  return (
    <form action={action} className="grid gap-3">
      <div>
        <button className={btnPrimary} type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send test email"}
        </button>
        <p className="mt-2 text-sm text-ink/70">
          Sends one message to the signed-in admin address and shows what ZeptoMail returned. The token is not shown.
        </p>
      </div>
      {state ? (
        <div className="grid gap-1 rounded-xl border border-sand bg-white px-3 py-2 text-sm" role="status">
          <p>
            <span className="text-ink/60">Result</span> {state.result}
          </p>
          <p className="break-all">
            <span className="text-ink/60">Endpoint</span> {state.endpoint}
          </p>
          <p>
            <span className="text-ink/60">HTTP status</span> {state.status ?? "none"}
          </p>
          {state.problems.length > 0 ? (
            <p>
              <span className="text-ink/60">Settings</span> {state.problems.join("; ")}
            </p>
          ) : null}
          <p className="text-ink/60">Response body</p>
          <pre className="whitespace-pre-wrap break-all font-sans">{state.body || "(empty)"}</pre>
        </div>
      ) : null}
    </form>
  );
}

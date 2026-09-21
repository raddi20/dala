"use client";

import { useActionState } from "react";
import { createReport } from "@/lib/actions/social";
import { REPORT_REASONS } from "@/lib/constants";
import { btnSecondary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function ReportForm({
  listingId,
  targetUserId,
}: {
  listingId?: string;
  targetUserId?: string;
}) {
  const [state, action] = useActionState(createReport, initial);
  if (state.ok) {
    return <p className="text-sm text-lake-dark">Report sent. A moderator can see it in the admin queue.</p>;
  }
  return (
    <form action={action} className="grid gap-3">
      <ErrorNote>{state.error}</ErrorNote>
      {listingId ? <input type="hidden" name="listingId" value={listingId} /> : null}
      {targetUserId ? <input type="hidden" name="targetUserId" value={targetUserId} /> : null}
      <label className="block text-sm">
        Reason
        <select name="reason" className={fieldClass} defaultValue={REPORT_REASONS[0]}>
          {REPORT_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Details
        <textarea name="details" rows={3} maxLength={1000} className={fieldClass} />
      </label>
      <SubmitButton className={btnSecondary} pendingLabel="Sending…">
        Submit report
      </SubmitButton>
    </form>
  );
}

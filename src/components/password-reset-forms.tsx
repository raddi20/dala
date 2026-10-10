"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/lib/actions/password-reset";
import { SubmitButton } from "@/components/submit-button";
import { btnPrimary, ErrorNote, fieldClass, Flash } from "@/components/ui";
import type { ActionState } from "@/lib/validators";

const initial: ActionState = { error: "" };

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      {state.message ? <Flash>{state.message}</Flash> : null}
      <label className="block text-sm">
        Email
        <input name="email" type="email" autoComplete="email" required className={fieldClass} />
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
      <p className="text-sm text-ink/70">
        <Link href="/login" className="font-semibold text-lake-dark">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, initial);
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm">
        New password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={fieldClass}
        />
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Saving password…">
        Save password
      </SubmitButton>
      <p className="text-sm text-ink/70">
        <Link href="/login" className="font-semibold text-lake-dark">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

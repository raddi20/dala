"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, resetPassword } from "@/lib/actions/password-reset";
import { SubmitButton } from "@/components/submit-button";
import { withNext } from "@/lib/utils";
import type { ActionState } from "@/lib/validators";
import { btnPrimary, ErrorNote, fieldClass, Flash } from "@/components/ui";

const initial: ActionState = { error: "" };

export function ForgotPasswordForm({ nextPath }: { nextPath: string }) {
  const [state, action] = useActionState(requestPasswordReset, initial);
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      {state.message ? <Flash>{state.message}</Flash> : null}
      <input type="hidden" name="next" value={nextPath} />
      <label className="block text-sm">
        Email
        <input name="email" type="email" autoComplete="email" required className={fieldClass} />
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
      <p className="text-sm text-ink/70">
        <Link href={withNext("/login", nextPath)} className="font-semibold text-lake-dark">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token, nextPath }: { token: string; nextPath: string }) {
  const [state, action] = useActionState(resetPassword, initial);
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="next" value={nextPath} />
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
        <Link href={withNext("/login", nextPath)} className="font-semibold text-lake-dark">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, register } from "@/lib/actions/auth";
import { TownOptions } from "@/components/town-options";
import { withNext } from "@/lib/utils";
import type { ActionState } from "@/lib/validators";
import { PasswordInput } from "@/components/password-input";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const initial: ActionState = { error: "" };

export function LoginForm({ nextPath, queryError }: { nextPath: string; queryError: string }) {
  const [state, action] = useActionState(login, initial);
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error || queryError}</ErrorNote>
      <input type="hidden" name="next" value={nextPath} />
      <label className="block text-sm">
        Email
        <input name="email" type="email" autoComplete="email" required className={fieldClass} />
      </label>
      <label className="block text-sm">
        Password
        <PasswordInput name="password" autoComplete="current-password" required className={fieldClass} />
      </label>
      <p className="text-right text-sm">
        <Link href={withNext("/forgot-password", nextPath)} className="font-semibold text-lake-dark">
          Forgot password?
        </Link>
      </p>
      <SubmitButton className={btnPrimary} pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-sm text-ink/70">
        No account?{" "}
        <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-lake-dark">
          Create one
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [state, action] = useActionState(register, initial);
  const [place, setPlace] = useState("Nairobi");
  return (
    <form action={action} className="grid gap-4">
      <ErrorNote>{state.error}</ErrorNote>
      <input type="hidden" name="next" value={nextPath} />
      <label className="block text-sm">
        Name
        <input name="name" required autoComplete="name" className={fieldClass} />
      </label>
      <label className="block text-sm">
        Email
        <input name="email" type="email" autoComplete="email" required className={fieldClass} />
      </label>
      <label className="block text-sm">
        Password
        <PasswordInput name="password" autoComplete="new-password" required minLength={8} className={fieldClass} />
      </label>
      <label className="block text-sm">
        Profile
        <select name="kind" className={fieldClass} defaultValue="person">
          <option value="person">Person</option>
          <option value="business">Business</option>
        </select>
      </label>
      <label className="block text-sm">
        Where you are
        <select
          name="city"
          className={fieldClass}
          value={place}
          onChange={(event) => setPlace(event.target.value === "London" ? "London" : "Nairobi")}
        >
          <option value="Nairobi">Kenya / East Africa</option>
          <option value="London">Diaspora</option>
        </select>
      </label>
      {place === "Nairobi" ? (
        <label className="block text-sm">
          Town <span className="text-ink/60">(optional)</span>
          <select name="town" className={fieldClass} defaultValue="">
            <TownOptions includeDiaspora={false} blank="Any town in Kenya / East Africa" />
          </select>
        </label>
      ) : null}
      <label className="flex items-start gap-3 text-sm leading-snug">
        <input name="terms" type="checkbox" value="1" required className="mt-1 h-4 w-4 shrink-0 accent-navy" />
        <span>
          I agree to the{" "}
          <Link href="/terms" className="font-semibold text-lake-dark hover:text-lake">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-lake-dark hover:text-lake">
            Privacy Policy
          </Link>
        </span>
      </label>
      <SubmitButton className={btnPrimary} pendingLabel="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-sm text-ink/70">
        Already registered?{" "}
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-lake-dark">
          Sign in
        </Link>
      </p>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, register } from "@/lib/actions/auth";
import { CITIES } from "@/lib/constants";
import { btnPrimary, ErrorNote, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { ActionState } from "@/lib/validators";

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
        <input name="password" type="password" autoComplete="current-password" required className={fieldClass} />
      </label>
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
        <input name="password" type="password" autoComplete="new-password" required minLength={8} className={fieldClass} />
      </label>
      <label className="block text-sm">
        Profile
        <select name="kind" className={fieldClass} defaultValue="person">
          <option value="person">Person</option>
          <option value="business">Business</option>
        </select>
      </label>
      <label className="block text-sm">
        City
        <select name="city" className={fieldClass} defaultValue="Nairobi">
          {CITIES.map((city) => (
            <option key={city.name} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>
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

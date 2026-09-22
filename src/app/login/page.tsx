import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { APP_NAME } from "@/lib/brand";
import { cardClass } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { authContinueCopy, one, safePath } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safePath(one(sp.next), "/");
  const user = await getSessionUser();
  if (user) redirect(next);
  const queryError = one(sp.error) === "CredentialsSignin" ? "Email or password is wrong." : "";

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center gap-6 px-4 py-12 sm:py-16">
      <div className="text-center">
        <p className="font-serif text-3xl text-navy">{APP_NAME}</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-ink/60">
          {authContinueCopy(next) || "Email and password. No email provider is required for this demo."}
        </p>
      </div>
      <div className={`${cardClass} grid gap-5 p-6`}>
        <div className="rounded-xl bg-amber-soft/80 px-3.5 py-3 text-sm text-ink/80">
          <p className="font-semibold text-clay-dark">Demo password for every seeded account: demo1234</p>
          <ul className="mt-2 grid gap-1 text-ink/70">
            <li>akinyi@dala.local — admin</li>
            <li>atieno@dala.local — Nairobi restaurant</li>
            <li>okello@dala.local — London solicitor</li>
            <li>james@dala.local — London resident</li>
          </ul>
        </div>
        <LoginForm nextPath={next} queryError={queryError} />
      </div>
    </div>
  );
}

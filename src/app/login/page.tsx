import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { getSessionUser } from "@/lib/session";
import { one, safePath } from "@/lib/utils";

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
    <div className="mx-auto grid max-w-md gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-ink/70">Email and password. No email provider is required for this demo.</p>
      </div>
      <div className="rounded-2xl border border-sand bg-sand/50 p-4 text-sm">
        <p className="font-semibold">Demo password for every seeded account: demo1234</p>
        <ul className="mt-2 grid gap-1">
          <li>akinyi@dala.local — admin</li>
          <li>atieno@dala.local — Nairobi restaurant</li>
          <li>okello@dala.local — London solicitor</li>
          <li>james@dala.local — London resident</li>
        </ul>
      </div>
      <LoginForm nextPath={next} queryError={queryError} />
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { getSessionUser } from "@/lib/session";
import { one, safePath } from "@/lib/utils";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const next = safePath(one(sp.next), "/");
  if (await getSessionUser()) redirect(next);

  return (
    <div className="mx-auto grid max-w-md gap-6 px-4 py-8">
      <div>
        <h1 className="font-serif text-3xl">Create an account</h1>
        <p className="mt-2 text-sm text-ink/70">Use a person profile or a business profile. You can change this later.</p>
      </div>
      <RegisterForm nextPath={next} />
    </div>
  );
}

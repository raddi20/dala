import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth-forms";
import { APP_NAME } from "@/lib/brand";
import { cardClass } from "@/components/ui";
import { getSessionUser } from "@/lib/session";
import { authContinueCopy, one, safePath } from "@/lib/utils";

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
    <div className="mx-auto flex max-w-md flex-col justify-center gap-6 px-4 py-12 sm:py-16">
      <div className="text-center">
        <p className="font-serif text-3xl text-navy">{APP_NAME}</p>
        <h1 className="mt-2 text-xl font-semibold text-ink">Create an account</h1>
        <p className="mt-2 text-sm text-ink/60">
          {authContinueCopy(next, "register") || "Use a person profile or a business profile. You can change this later."}
        </p>
      </div>
      <div className={`${cardClass} p-6`}>
        <RegisterForm nextPath={next} />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/password-reset-forms";
import { Wordmark } from "@/components/wordmark";
import { cardClass } from "@/components/ui";
import { one, safePath } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safePath(one((await searchParams).next), "/");
  return (
    <div className="mx-auto flex max-w-md flex-col justify-center gap-6 px-4 py-12 sm:py-16">
      <div className="text-center">
        <div className="flex justify-center">
          <Wordmark size="lg" />
        </div>
        <h1 className="mt-2 text-xl font-semibold text-ink">Forgot password</h1>
        <p className="mt-2 text-sm text-ink/60">
          Enter the email on the account. If we have it, we will send a link to choose a new password.
        </p>
      </div>
      <div className={`${cardClass} p-6`}>
        <ForgotPasswordForm nextPath={next} />
      </div>
    </div>
  );
}

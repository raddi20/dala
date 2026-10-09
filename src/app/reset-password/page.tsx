import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/password-reset-forms";
import { Wordmark } from "@/components/wordmark";
import { cardClass } from "@/components/ui";
import { one } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = one((await searchParams).token).trim();

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center gap-6 px-4 py-12 sm:py-16">
      <div className="text-center">
        <div className="flex justify-center">
          <Wordmark size="lg" />
        </div>
        <h1 className="mt-2 text-xl font-semibold text-ink">Choose a new password</h1>
        <p className="mt-2 text-sm text-ink/60">Use at least 8 characters. This replaces the old password.</p>
      </div>
      <div className={`${cardClass} grid gap-4 p-6`}>
        {token.length >= 20 ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <p className="text-sm text-ink/70">This link is missing or too short. Ask for a new one.</p>
            <Link href="/forgot-password" className="text-sm font-semibold text-lake-dark">
              Forgot password
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

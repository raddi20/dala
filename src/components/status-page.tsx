"use client";

import Link from "next/link";
import { btnNavy, btnPrimary, btnSecondary } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import { BUSINESS_PHONE_TEL } from "@/lib/public-info";
import { scrubText } from "@/lib/sentry";

const actionClass = "min-h-11 w-full";

export function StatusPage({
  title,
  body,
  digest,
  onRetry,
}: {
  title: string;
  body: string;
  digest?: string;
  onRetry?: () => void;
}) {
  const digits = BUSINESS_PHONE_TEL.replace(/\D/g, "");
  const whatsapp = digits ? `https://wa.me/${digits}` : "/contact";
  const reference = digest ? scrubText(digest) : "";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-12 text-center sm:py-20">
      <Wordmark size="lg" />
      <h1 className="mt-6 font-serif text-3xl text-navy sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-ink/70">{body}</p>
      {reference ? <p className="mt-3 text-xs text-ink/50">Reference {reference}</p> : null}
      <div className="mt-8 flex w-full flex-col gap-3 sm:max-w-xs">
        {onRetry ? (
          <button type="button" onClick={onRetry} className={`${btnPrimary} ${actionClass}`}>
            Try again
          </button>
        ) : null}
        <Link href="/" className={`${btnNavy} ${actionClass}`}>
          Home
        </Link>
        <Link href="/listings" className={`${onRetry ? btnSecondary : btnPrimary} ${actionClass}`}>
          Browse listings
        </Link>
        <Link href="/contact" className={`${btnSecondary} ${actionClass}`}>
          Contact us
        </Link>
        <a href={whatsapp} className={`${btnSecondary} ${actionClass}`}>
          WhatsApp us
        </a>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { APP_MEANING, APP_TAGLINE, appName } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-sand/80 bg-card/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-ink/65 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-2">
            {APP_TAGLINE} {appName()} is {APP_MEANING}. Discovery here — chat stays on WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-medium text-ink/80">
          <Link href="/occasions" className="hover:text-navy">
            Occasions
          </Link>
          <Link href="/categories" className="hover:text-navy">
            Categories
          </Link>
          <Link href="/pricing" className="hover:text-navy">
            Pricing
          </Link>
          <Link href="/video-policy" className="hover:text-navy">
            Video policy
          </Link>
          <Link href="/listings?type=business" className="hover:text-navy">
            Directory
          </Link>
          <Link href="/listings?type=classifieds" className="hover:text-navy">
            Classifieds
          </Link>
          <Link href="/listings/new" className="hover:text-navy">
            List a business
          </Link>
          <Link href="/account/storefront" className="hover:text-navy">
            Open a shop
          </Link>
        </div>
      </div>
    </footer>
  );
}

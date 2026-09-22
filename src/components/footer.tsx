import Link from "next/link";
import { APP_MEANING, APP_NAME } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-sand/80 bg-card/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-ink/65 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="font-serif text-lg text-navy">{APP_NAME}</p>
          <p className="mt-1">
            Working name ({APP_MEANING}). Discovery and trust here — chat stays on WhatsApp.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-medium text-ink/80">
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

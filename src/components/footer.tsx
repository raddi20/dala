import Link from "next/link";
import { APP_MEANING, APP_NAME } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-sand">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-ink/70 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {APP_NAME} is a working name ({APP_MEANING}). Chat stays on WhatsApp.
        </p>
        <div className="flex gap-3">
          <Link href="/listings?type=business" className="hover:underline">
            Directory
          </Link>
          <Link href="/listings?type=classifieds" className="hover:underline">
            Classifieds
          </Link>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { btnPrimary } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="flex justify-center">
        <Wordmark size="lg" />
      </div>
      <h1 className="mt-3 font-serif text-3xl text-navy">That page is not here</h1>
      <p className="mt-2 text-sm text-ink/60">
        The listing may be hidden, the shop may be unpublished, or the link is wrong.
      </p>
      <Link href="/listings" className={`${btnPrimary} mt-6`}>
        Browse listings
      </Link>
    </div>
  );
}

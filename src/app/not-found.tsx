import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-serif text-3xl">That page is not here</h1>
      <p className="mt-2 text-sm text-ink/70">The listing may be hidden, or the link is wrong.</p>
      <Link href="/listings" className={`${btnPrimary} mt-4`}>
        Browse listings
      </Link>
    </div>
  );
}

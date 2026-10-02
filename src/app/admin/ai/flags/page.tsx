import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "AI flags" };
export const dynamic = "force-dynamic";

export default async function AdminAiFlagsPage() {
  await requireAdmin();
  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
      <h1 className="font-serif text-3xl">AI flags</h1>
      <p className="text-sm text-ink/70">
        The moderation queue is not in this release. Nothing here hides, deletes, or publishes a listing.
      </p>
      <p className="text-sm">
        <Link href="/admin/ai" className="font-semibold text-lake-dark underline">
          AI usage
        </Link>
      </p>
    </div>
  );
}

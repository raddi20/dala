import type { Metadata } from "next";
import { SavedView } from "@/components/saved-view";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Saved", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SavedPage({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const tab = sp.tab === "recent" ? "recent" : "saved";
  return (
    <div className="mx-auto grid max-w-3xl gap-4 px-4 py-6 pb-28">
      <h1 className="font-serif text-3xl text-navy">Saved</h1>
      <SavedView initialTab={tab} signedIn={Boolean(user)} />
    </div>
  );
}

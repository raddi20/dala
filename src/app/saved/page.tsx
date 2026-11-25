import type { Metadata } from "next";
import { FollowedShops } from "@/components/followed-shops";
import { SavedView } from "@/components/saved-view";
import { shopsFollowedBy } from "@/lib/community/follow-db";
import { getSessionUser } from "@/lib/session";

export const metadata: Metadata = { title: "Saved", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SavedPage({ searchParams }: Props) {
  const sp = await searchParams;
  const user = await getSessionUser();
  const tab = sp.tab === "recent" ? "recent" : "saved";
  const followed = user ? await shopsFollowedBy(user.id) : [];
  return (
    <div className="mx-auto grid min-w-0 max-w-3xl gap-4 px-4 py-6">
      <h1 className="font-serif text-3xl text-navy">Saved</h1>
      {user ? (
        <FollowedShops
          returnTo="/saved"
          shops={followed.map((row) => ({
            id: row.shop.id,
            slug: row.shop.slug,
            name: row.shop.user.name,
            city: row.shop.user.city,
          }))}
        />
      ) : (
        <p className="text-sm text-ink/70">Sign in to see shops you follow. Hearts on this phone stay here either way.</p>
      )}
      <SavedView initialTab={tab} signedIn={Boolean(user)} />
    </div>
  );
}

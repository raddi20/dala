import { cityChipLabel } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { cleanIds, type SavedItem } from "@/lib/saved";
import { getSessionUser } from "@/lib/session";
import { liveOwner } from "@/lib/visibility";

export const dynamic = "force-dynamic";

const unauthorized = () => Response.json({ error: "sign_in" }, { status: 401 });

async function body(request: Request) {
  try {
    return cleanIds(((await request.json()) as { ids?: unknown })?.ids);
  } catch {
    return [];
  }
}

/** The signed-in person's hearts, only listings that are still public. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const rows = await prisma.savedListing.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const listings = await prisma.listing.findMany({
    where: { id: { in: rows.map((row) => row.listingId) }, hidden: false, owner: liveOwner },
    select: { id: true, title: true, photoUrl: true, priceLabel: true, city: true },
  });
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  const items: SavedItem[] = [];
  for (const row of rows) {
    const listing = byId.get(row.listingId);
    if (!listing) continue;
    items.push({
      id: listing.id,
      title: listing.title,
      photo: listing.photoUrl,
      price: listing.priceLabel,
      place: cityChipLabel(listing.city),
      at: row.createdAt.getTime(),
    });
  }
  return Response.json({ items, ids: rows.map((row) => row.listingId) });
}

/** Adds hearts. Unknown listing ids are ignored. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const ids = await body(request);
  if (ids.length === 0) return Response.json({ added: 0 });
  const real = await prisma.listing.findMany({ where: { id: { in: ids } }, select: { id: true } });
  let added = 0;
  for (const { id } of real) {
    await prisma.savedListing.upsert({
      where: { userId_listingId: { userId: user.id, listingId: id } },
      update: {},
      create: { userId: user.id, listingId: id },
    });
    added += 1;
  }
  return Response.json({ added });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const ids = await body(request);
  const { count } = await prisma.savedListing.deleteMany({ where: { userId: user.id, listingId: { in: ids } } });
  return Response.json({ removed: count });
}

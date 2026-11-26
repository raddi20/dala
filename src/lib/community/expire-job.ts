import { deleteUpdatePhoto } from "@/lib/community/photos";
import { prisma } from "@/lib/prisma";

export const EXPIRE_BATCH = 50;

/** Deletes expired shop updates and their Blob photos. Public reads already hide them. */
export async function expireShopUpdates(now = new Date()): Promise<{ deleted: number }> {
  const rows = await prisma.shopUpdate.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true, photoUrl: true },
    take: EXPIRE_BATCH,
    orderBy: { expiresAt: "asc" },
  });
  for (const row of rows) {
    if (row.photoUrl) await deleteUpdatePhoto(row.photoUrl);
  }
  if (rows.length === 0) return { deleted: 0 };
  const result = await prisma.shopUpdate.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  return { deleted: result.count };
}

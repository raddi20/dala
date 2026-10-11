import { PrismaClient } from "@prisma/client";
import { backfillMode, blobHost, isVariantComplete, type VariantRecord } from "../src/lib/image-variants";
import { storeImageVariants } from "../src/lib/image-variant-store";

const prisma = new PrismaClient();

type PhotoRow = { kind: string; id: string; url: string };

function flag(name: string) {
  return process.argv.includes(name);
}

async function collect(): Promise<PhotoRow[]> {
  const [listings, offerings, shops, users] = await Promise.all([
    prisma.listing.findMany({ where: { photoUrl: { not: "" } }, select: { id: true, photoUrl: true } }),
    prisma.offering.findMany({ where: { imageUrl: { not: "" } }, select: { id: true, imageUrl: true } }),
    prisma.storefront.findMany({ where: { bannerUrl: { not: "" } }, select: { id: true, bannerUrl: true } }),
    prisma.user.findMany({ where: { avatarUrl: { not: "" } }, select: { id: true, avatarUrl: true } }),
  ]);
  return [
    ...listings.map((row) => ({ kind: "listing", id: row.id, url: row.photoUrl.trim() })),
    ...offerings.map((row) => ({ kind: "offering", id: row.id, url: row.imageUrl.trim() })),
    ...shops.map((row) => ({ kind: "banner", id: row.id, url: row.bannerUrl.trim() })),
    ...users.map((row) => ({ kind: "avatar", id: row.id, url: row.avatarUrl.trim() })),
  ].filter((row) => blobHost(row.url));
}

async function main() {
  const mode = backfillMode(flag("--apply"), process.env.VERCEL_ENV === "production", flag("--yes-production"));
  if (mode === "refuse") {
    console.error(
      "Refusing to write while VERCEL_ENV=production. Dry-run is safe. Add --yes-production only when Kevin is ready to backfill the live Blob store.",
    );
    process.exitCode = 1;
    return;
  }
  const apply = mode === "apply";

  const photos = await collect();
  const existingRows = photos.length
    ? await prisma.imageVariant.findMany({
        where: { sourceUrl: { in: photos.map((photo) => photo.url) } },
        select: { sourceUrl: true, thumb480: true, thumb960: true, longest: true },
      })
    : [];
  const existing = new Map<string, VariantRecord>(
    existingRows.map((row) => [row.sourceUrl, { thumb480: row.thumb480, thumb960: row.thumb960, longest: row.longest }]),
  );

  const pending = photos.filter((photo) => !isVariantComplete(existing.get(photo.url)));
  const done = photos.length - pending.length;
  console.log(
    `${apply ? "Apply" : "Dry run"}. ${photos.length} Blob photo${photos.length === 1 ? "" : "s"}, ${done} already have variants, ${pending.length} ${apply ? "will be written" : "would be written"}.`,
  );
  for (const photo of pending) {
    console.log(`  ${photo.kind} ${photo.id} ${photo.url}`);
  }
  if (!apply) {
    console.log("Nothing was written. Re-run with --apply to store 480px and 960px WebP files next to the originals.");
    console.log("Do not point this at production until the launch backfill. Local: node --env-file=.env --import tsx scripts/backfill-image-variants.ts --apply");
    return;
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    console.error("BLOB_READ_WRITE_TOKEN is not set, so variants cannot be stored.");
    process.exitCode = 1;
    return;
  }

  let wrote = 0;
  let failed = 0;
  for (const photo of pending) {
    try {
      const response = await fetch(photo.url);
      if (!response.ok) throw new Error(`Fetch failed (${response.status})`);
      const bytes = Buffer.from(await response.arrayBuffer());
      await storeImageVariants(photo.url, bytes);
      wrote += 1;
      console.log(`  wrote ${photo.kind} ${photo.id}`);
    } catch (error) {
      failed += 1;
      console.error(`  failed ${photo.kind} ${photo.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  console.log(`Wrote variants for ${wrote} photo${wrote === 1 ? "" : "s"}.${failed ? ` ${failed} failed.` : ""}`);
  if (failed) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

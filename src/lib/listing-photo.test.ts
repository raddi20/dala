import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { CARD_ASPECT } from "@/lib/photo-edit";
import { listingPhotoTarget, mayReadListingPhoto } from "@/lib/listing-photo";
import { LISTING_DETAIL_PHOTO, LISTING_PHOTO_ASPECT, LISTING_PHOTO_ASPECT_CLASS } from "@/lib/listing-photo-frame";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const blob = "https://store.public.blob.vercel-storage.com/sofa.jpg";

test("listing cards and the listing page share one 4:3 frame", () => {
  assert.equal(LISTING_PHOTO_ASPECT, 4 / 3);
  assert.equal(CARD_ASPECT, LISTING_PHOTO_ASPECT);
  assert.equal(LISTING_PHOTO_ASPECT_CLASS, "aspect-[4/3]");
  assert.equal(LISTING_DETAIL_PHOTO.width / LISTING_DETAIL_PHOTO.height, LISTING_PHOTO_ASPECT);

  const detail = read("src/app/listings/[id]/page.tsx");
  const card = read("src/components/item-card.tsx");
  const shop = read("src/app/b/[slug]/page.tsx");
  for (const source of [detail, card, shop]) {
    assert.match(source, /LISTING_PHOTO_ASPECT_CLASS/);
    assert.match(source, /object-cover/);
    assert.doesNotMatch(source, /16\/10/);
  }
});

test("a listing photo can be replaced only with a stored blob url", () => {
  assert.deepEqual(listingPhotoTarget("  clabc123 ", `  ${blob}  `), { id: "clabc123", photoUrl: blob });
  assert.equal(listingPhotoTarget("clabc123", "https://images.unsplash.com/photo"), null);
  assert.equal(listingPhotoTarget("clabc123", "http://store.public.blob.vercel-storage.com/sofa.jpg"), null);
  assert.equal(listingPhotoTarget("../etc", blob), null);
  assert.equal(listingPhotoTarget("", blob), null);
});

test("only an admin or the owner can read the current listing photo back", () => {
  const base = { role: "user", userId: "owner", ownerId: "owner", storedUrl: blob, requestedUrl: blob };
  assert.equal(mayReadListingPhoto(base), true);
  assert.equal(mayReadListingPhoto({ ...base, role: "admin", userId: "mod" }), true);
  assert.equal(mayReadListingPhoto({ ...base, userId: "other" }), false);
  assert.equal(mayReadListingPhoto({ ...base, ownerId: null, storedUrl: "" }), false);
  assert.equal(mayReadListingPhoto({ ...base, requestedUrl: `${blob}?x=1` }), false);
  assert.equal(
    mayReadListingPhoto({
      role: "admin",
      userId: "mod",
      ownerId: "owner",
      storedUrl: "https://evil.example/a.jpg",
      requestedUrl: "https://evil.example/a.jpg",
    }),
    false,
  );
});

test("admin listings reframe the current photo through the shared editor", () => {
  const page = read("src/app/admin/listings/page.tsx");
  const ui = read("src/components/listing-photo-reframe.tsx");
  const field = read("src/components/photo-field.tsx");
  const action = read("src/lib/actions/listing-photo.ts");
  const source = read("src/app/api/uploads/source/route.ts");

  assert.match(page, /ListingPhotoReframe/);
  assert.match(page, /requireAdmin\("\/admin\/listings"\)/);
  assert.ok(page.indexOf("requireAdmin") < page.indexOf("prisma.listing.findMany"));

  assert.match(ui, /Reframe photo/);
  assert.match(ui, /PhotoEditorHost/);
  assert.match(ui, /uploadPhoto/);
  assert.match(ui, /replaceListingPhoto/);
  assert.match(ui, /fileFromListingPhoto/);
  assert.doesNotMatch(ui, /from "@\/components\/photo-editor"/);
  assert.doesNotMatch(ui, /type="file"/);

  assert.match(field, /Reframe photo/);
  assert.match(field, /export function PhotoEditorHost/);
  assert.match(field, /import\("@\/components\/photo-editor"\)/);

  assert.match(action, /requireAdmin\("\/admin\/listings"\)/);
  assert.match(action, /storeImageVariants/);
  assert.match(action, /listing\.reframe/);
  const save = action.slice(action.indexOf("export async function replaceListingPhoto"));
  assert.ok(save.indexOf("requireAdmin") < save.indexOf("prisma.listing.update"));
  assert.ok(save.indexOf("ensureListingPhotoVariants") < save.indexOf("prisma.listing.update"));

  assert.match(source, /getSessionUser/);
  assert.match(source, /mayReadListingPhoto/);
  assert.match(source, /downloadListingPhoto/);
  const load = source.slice(source.indexOf("export async function GET"));
  assert.ok(load.indexOf("getSessionUser") < load.indexOf("downloadListingPhoto"));
  assert.ok(load.indexOf("mayReadListingPhoto") < load.indexOf("downloadListingPhoto"));
});

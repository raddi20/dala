import assert from "node:assert/strict";
import test from "node:test";
import {
  clientImageChoiceError,
  extensionForImageType,
  MAX_IMAGE_BYTES,
  validateImagePayload,
} from "./image-file";
import { decideUpload, type UploadUser } from "./image-upload";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x00]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);

const seller: UploadUser = { id: "seller1", role: "user", verifiedPro: false };
const pro: UploadUser = { id: "seller1", role: "user", verifiedPro: true };
const admin: UploadUser = { id: "admin1", role: "admin", verifiedPro: false };

test("validateImagePayload accepts jpeg, png, and webp headers", () => {
  assert.deepEqual(validateImagePayload({ type: "image/jpeg", size: jpeg.length, bytes: jpeg }), {
    ok: true,
    contentType: "image/jpeg",
  });
  assert.equal(validateImagePayload({ type: "image/jpg", size: jpeg.length, bytes: jpeg }).ok, true);
  assert.equal(validateImagePayload({ type: "", size: png.length, name: "shop.PNG", bytes: png }).ok, true);
  const webpResult = validateImagePayload({ type: "image/webp", size: webp.length, bytes: webp });
  assert.equal(webpResult.ok && webpResult.contentType, "image/webp");
  assert.equal(extensionForImageType("image/jpeg"), "jpg");
  assert.equal(extensionForImageType("image/png"), "png");
  assert.equal(extensionForImageType("image/webp"), "webp");
});

test("validateImagePayload rejects other types, mismatches, and oversized files", () => {
  assert.equal(validateImagePayload({ type: "image/gif", size: gif.length, bytes: gif }).ok, false);
  assert.equal(validateImagePayload({ type: "image/png", size: jpeg.length, name: "x.png", bytes: jpeg }).ok, false);
  assert.equal(validateImagePayload({ type: "image/jpeg", size: 0, bytes: jpeg }).ok, false);
  assert.equal(validateImagePayload({ type: "image/jpeg", size: MAX_IMAGE_BYTES, bytes: jpeg }).ok, true);
  assert.equal(validateImagePayload({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1, bytes: jpeg }).ok, false);
});

test("clientImageChoiceError guides phone photos", () => {
  assert.equal(clientImageChoiceError({ type: "image/jpeg", size: 1200, name: "IMG_1.jpg" }), null);
  assert.match(clientImageChoiceError({ type: "image/heic", size: 1200, name: "IMG.HEIC" }) ?? "", /HEIC/);
  assert.match(clientImageChoiceError({ type: "", size: 1200, name: "notes.pdf" }) ?? "", /JPEG/);
  assert.match(clientImageChoiceError({ type: "image/jpeg", size: 21 * 1024 * 1024, name: "big.jpg" }) ?? "", /20 MB/);
  assert.match(clientImageChoiceError({ type: "image/jpeg", size: 0, name: "empty.jpg" }) ?? "", /empty/);
});

test("decideUpload keeps new photos on the signed-in user", () => {
  const avatar = decideUpload({ user: seller, purpose: "avatar", resourceId: "other" });
  assert.equal(avatar.ok && avatar.pathname, "users/seller1/avatar");

  const listing = decideUpload({ user: seller, purpose: "listing", resourceId: "" });
  assert.equal(listing.ok && listing.pathname, "users/seller1/listing");

  const offering = decideUpload({
    user: seller,
    purpose: "offering",
    resourceId: "",
    ownStorefront: { id: "shop1" },
  });
  assert.equal(offering.ok && offering.pathname, "users/seller1/offering");

  const banner = decideUpload({
    user: pro,
    purpose: "banner",
    resourceId: "",
    ownStorefront: { id: "shop1" },
  });
  assert.equal(banner.ok && banner.pathname, "users/seller1/banner");
});

test("decideUpload refuses another seller and allows the owner or an admin", () => {
  const stranger = decideUpload({
    user: seller,
    purpose: "listing",
    resourceId: "listing1",
    listing: { ownerId: "other1" },
  });
  assert.equal(stranger.ok, false);
  if (!stranger.ok) assert.equal(stranger.status, 403);

  const owner = decideUpload({
    user: seller,
    purpose: "listing",
    resourceId: "listing1",
    listing: { ownerId: "seller1" },
  });
  assert.equal(owner.ok && owner.pathname, "users/seller1/listing");

  const asAdmin = decideUpload({
    user: admin,
    purpose: "listing",
    resourceId: "listing1",
    listing: { ownerId: "seller1" },
  });
  assert.equal(asAdmin.ok && asAdmin.pathname, "users/seller1/listing");

  const otherShop = decideUpload({
    user: seller,
    purpose: "offering",
    resourceId: "off1",
    ownStorefront: { id: "shop1" },
    offering: { storefrontId: "shop2", ownerUserId: "other1" },
  });
  assert.equal(otherShop.ok, false);
  if (!otherShop.ok) assert.equal(otherShop.status, 403);

  const adminShop = decideUpload({
    user: admin,
    purpose: "offering",
    resourceId: "off1",
    offering: { storefrontId: "shop2", ownerUserId: "other1" },
  });
  assert.equal(adminShop.ok && adminShop.pathname, "users/other1/offering");
});

test("decideUpload requires a shop, and Pro, before a cover photo", () => {
  const noShop = decideUpload({ user: seller, purpose: "offering", resourceId: "" });
  assert.equal(noShop.ok, false);
  if (!noShop.ok) assert.equal(noShop.status, 403);

  const missing = decideUpload({
    user: seller,
    purpose: "offering",
    resourceId: "missing",
    ownStorefront: { id: "shop1" },
    offering: null,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.status, 404);

  const freeBanner = decideUpload({
    user: seller,
    purpose: "banner",
    resourceId: "",
    ownStorefront: { id: "shop1" },
  });
  assert.equal(freeBanner.ok, false);
  if (!freeBanner.ok) assert.equal(freeBanner.status, 403);

  const adminBanner = decideUpload({
    user: admin,
    purpose: "banner",
    resourceId: "",
    ownStorefront: { id: "adminshop" },
  });
  assert.equal(adminBanner.ok && adminBanner.pathname, "users/admin1/banner");

  assert.equal(decideUpload({ user: seller, purpose: "nope", resourceId: "" }).ok, false);
  const weird = decideUpload({ user: seller, purpose: "listing", resourceId: "../secret" });
  assert.equal(weird.ok, false);
  if (!weird.ok) assert.equal(weird.status, 400);
});

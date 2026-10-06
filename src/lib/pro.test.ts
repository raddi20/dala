import assert from "node:assert/strict";
import test from "node:test";
import { FREE_OFFERING_CAP, PRO_DAYS, PRO_OFFERING_CAP, offeringCap } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import {
  extendProUntil,
  formatPlanDate,
  hiddenOfferings,
  isProActive,
  proGraceUntil,
  proLapsed,
  setUserPro,
  visibleOfferings,
} from "@/lib/pro";
import { shopVideoHiddenByPro, shopVideoIsPublic } from "@/lib/video/machine";

const DAY_MS = 86_400_000;
const now = new Date("2026-10-06T12:00:00.000Z");

function offering(title: string, sortOrder: number, createdAt: string) {
  return { title, sortOrder, createdAt: new Date(createdAt), archived: false };
}

test("Pro stays on until the end date, and a missing end date does not turn an existing plan off", () => {
  const future = new Date(now.getTime() + DAY_MS);
  const past = new Date(now.getTime() - DAY_MS);
  assert.equal(isProActive({ verifiedPro: true, verifiedProUntil: future }, now), true);
  assert.equal(isProActive({ verifiedPro: true, verifiedProUntil: past }, now), false);
  assert.equal(isProActive({ verifiedPro: true, verifiedProUntil: now }, now), false);
  assert.equal(isProActive({ verifiedPro: true, verifiedProUntil: null }, now), true);
  assert.equal(isProActive({ verifiedPro: false, verifiedProUntil: future }, now), false);
  assert.equal(isProActive({ verifiedPro: false, verifiedProUntil: null }, now), false);
  assert.equal(proLapsed({ verifiedPro: true, verifiedProUntil: past }, now), true);
  assert.equal(proLapsed({ verifiedPro: true, verifiedProUntil: null }, now), false);
  assert.equal(proGraceUntil(now).toISOString(), new Date(now.getTime() + PRO_DAYS * DAY_MS).toISOString());
  assert.equal(formatPlanDate(now), "6 Oct 2026");
});

test("extension starts from now when the plan has ended, and from the current end date when it has not", () => {
  const future = new Date(now.getTime() + 10 * DAY_MS);
  const past = new Date(now.getTime() - 3 * DAY_MS);
  assert.equal(extendProUntil(null, now).toISOString(), new Date(now.getTime() + PRO_DAYS * DAY_MS).toISOString());
  assert.equal(extendProUntil(past, now).toISOString(), new Date(now.getTime() + PRO_DAYS * DAY_MS).toISOString());
  assert.equal(extendProUntil(future, now).toISOString(), new Date(future.getTime() + PRO_DAYS * DAY_MS).toISOString());
});

test("the first five offerings in shop order stay public when Pro ends, and renewal shows them all", () => {
  const saved = [
    offering("Oldest", 0, "2026-01-01T00:00:00.000Z"),
    offering("Second", 1, "2026-01-02T00:00:00.000Z"),
    offering("Third", 2, "2026-01-03T00:00:00.000Z"),
    offering("Fourth", 3, "2026-01-04T00:00:00.000Z"),
    offering("Fifth", 4, "2026-01-05T00:00:00.000Z"),
    offering("Sixth", 5, "2026-01-06T00:00:00.000Z"),
    offering("Seventh", 6, "2026-01-07T00:00:00.000Z"),
  ];
  const lapsed = { verifiedPro: true, verifiedProUntil: new Date(now.getTime() - DAY_MS) };
  const active = { verifiedPro: true, verifiedProUntil: new Date(now.getTime() + DAY_MS) };
  assert.equal(offeringCap(isProActive(lapsed, now)), FREE_OFFERING_CAP);
  assert.equal(offeringCap(isProActive(active, now)), PRO_OFFERING_CAP);
  assert.deepEqual(
    visibleOfferings(saved, false).map((item) => item.title),
    ["Oldest", "Second", "Third", "Fourth", "Fifth"],
  );
  assert.deepEqual(
    hiddenOfferings(saved, false).map((item) => item.title),
    ["Sixth", "Seventh"],
  );
  assert.equal(visibleOfferings(saved, true).length, 7);
  assert.equal(hiddenOfferings(saved, true).length, 0);
  assert.equal(saved.length, 7);
});

test("an expired Pro plan hides the shop video and shows it again on renewal, without deleting it", () => {
  const playback = "publicPlayback";
  const expired = { verifiedPro: true, verifiedProUntil: new Date("2020-01-01T00:00:00.000Z") };
  const renewed = { verifiedPro: true, verifiedProUntil: new Date(Date.now() + PRO_DAYS * DAY_MS) };
  const hidden = {
    verifiedPro: isProActive(expired),
    published: true,
    status: "approved",
    publicPlaybackId: playback,
  };
  assert.equal(shopVideoIsPublic(hidden), false);
  assert.equal(shopVideoHiddenByPro(hidden), true);
  assert.equal(shopVideoIsPublic({ ...hidden, verifiedPro: isProActive(renewed) }), true);
  assert.equal(shopVideoHiddenByPro({ ...hidden, verifiedPro: isProActive(renewed) }), false);
  assert.equal(playback, "publicPlayback");
});

async function shopFixture() {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({
    data: {
      email: `pro-rule-${stamp}@example.com`,
      name: "Pro Rule",
      passwordHash: "x",
      city: "Nairobi",
      verifiedPro: true,
      verifiedProUntil: null,
    },
  });
  const shop = await prisma.storefront.create({
    data: { userId: user.id, slug: `pro-rule-${stamp}`, published: true, bannerUrl: "https://cdn.example/cover.jpg" },
  });
  return { user, shop, stamp };
}

test("expiry hides extra offerings and the video without deleting them, and renewal brings them back", async () => {
  const { user, shop } = await shopFixture();
  try {
    const past = new Date(Date.now() - DAY_MS);
    await prisma.user.update({ where: { id: user.id }, data: { verifiedProUntil: past } });
    const titles = ["One", "Two", "Three", "Four", "Five", "Six", "Seven"];
    for (const [index, title] of titles.entries()) {
      await prisma.offering.create({
        data: {
          storefrontId: shop.id,
          title,
          sortOrder: index,
          createdAt: new Date(Date.UTC(2026, 0, index + 1)),
        },
      });
    }
    const video = await prisma.shopVideo.create({
      data: { storefrontId: shop.id, status: "approved", publicPlaybackId: "kept-video" },
    });
    const saved = await prisma.offering.findMany({
      where: { storefrontId: shop.id, archived: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const lapsedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(isProActive(lapsedUser), false);
    assert.deepEqual(
      visibleOfferings(saved, isProActive(lapsedUser)).map((item) => item.title),
      ["One", "Two", "Three", "Four", "Five"],
    );
    assert.equal(hiddenOfferings(saved, false).length, 2);
    assert.equal(
      shopVideoIsPublic({
        verifiedPro: isProActive(lapsedUser),
        published: true,
        status: video.status,
        publicPlaybackId: video.publicPlaybackId,
      }),
      false,
    );

    const renewedUntil = extendProUntil(lapsedUser.verifiedProUntil, new Date());
    await prisma.user.update({
      where: { id: user.id },
      data: { verifiedPro: true, verifiedProUntil: renewedUntil },
    });
    const renewed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const stillThere = await prisma.offering.findMany({
      where: { storefrontId: shop.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const videoAfter = await prisma.shopVideo.findUniqueOrThrow({ where: { id: video.id } });
    assert.equal(stillThere.length, 7);
    assert.equal(stillThere.every((item) => item.archived === false), true);
    assert.equal(visibleOfferings(stillThere.filter((item) => !item.archived), isProActive(renewed)).length, 7);
    assert.equal(videoAfter.publicPlaybackId, "kept-video");
    assert.equal(videoAfter.status, "approved");
    assert.equal(
      shopVideoIsPublic({
        verifiedPro: isProActive(renewed),
        published: true,
        status: videoAfter.status,
        publicPlaybackId: videoAfter.publicPlaybackId,
      }),
      true,
    );
    const shopAfter = await prisma.storefront.findUniqueOrThrow({ where: { id: shop.id } });
    assert.equal(shopAfter.bannerUrl, "https://cdn.example/cover.jpg");
    assert.equal(shopAfter.phoneVerified, false);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("an admin grant adds 30 days and a second grant extends it, and revoke clears the plan without the shop checks", async () => {
  const { user, shop } = await shopFixture();
  try {
    await prisma.storefront.update({
      where: { id: shop.id },
      data: { phoneVerified: true, locationVerified: true },
    });
    const first = await setUserPro(prisma, user.id, true, now);
    assert.ok(first);
    assert.equal(first.verifiedPro, true);
    assert.equal(first.verifiedProUntil?.toISOString(), new Date(now.getTime() + PRO_DAYS * DAY_MS).toISOString());

    const later = new Date(now.getTime() + 5 * DAY_MS);
    const second = await setUserPro(prisma, user.id, true, later);
    assert.ok(second?.verifiedProUntil);
    assert.equal(second.verifiedProUntil.toISOString(), new Date(first.verifiedProUntil!.getTime() + PRO_DAYS * DAY_MS).toISOString());

    const removed = await setUserPro(prisma, user.id, false, later);
    assert.equal(removed?.verifiedPro, false);
    assert.equal(removed?.verifiedProUntil, null);
    const flags = await prisma.storefront.findUniqueOrThrow({ where: { id: shop.id } });
    assert.equal(flags.phoneVerified, true);
    assert.equal(flags.locationVerified, true);
    assert.equal(flags.businessVerified, false);
    const events = await prisma.shopBadgeEvent.count({ where: { storefrontId: shop.id } });
    assert.equal(events, 0);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

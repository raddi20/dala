import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/prisma";
import { fulfillPaidPayment } from "@/lib/payments/fulfill";

async function fixture() {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const user = await prisma.user.create({
    data: {
      email: `pay-test-${stamp}@example.com`,
      name: "Pay Test",
      passwordHash: "x",
      city: "Nairobi",
    },
  });
  const listing = await prisma.listing.create({
    data: {
      type: "business",
      title: "Pay test listing",
      description: "A listing used to test checkout fulfillment.",
      category: "Retail / shops",
      city: "Nairobi",
      region: "homeland",
      ownerId: user.id,
    },
  });
  return { user, listing, stamp };
}

test("fulfill applies Featured once when the webhook is retried", async () => {
  const { user, listing, stamp } = await fixture();
  try {
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        listingId: listing.id,
        product: "featured",
        method: "mpesa",
        amount: "KES 1,500",
        amountValue: 1500,
        currency: "KES",
        reference: `dala_test_featured_${stamp}`,
        provider: "flutterwave",
        status: "pending",
      },
    });
    const input = {
      reference: payment.reference,
      providerId: "99",
      amount: 1500,
      currency: "KES",
      method: "mpesa" as const,
      testMode: true,
    };
    const first = await fulfillPaidPayment(input);
    const afterFirst = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    const sentinel = new Date("2030-01-01T00:00:00.000Z");
    await prisma.listing.update({ where: { id: listing.id }, data: { featuredUntil: sentinel } });
    const second = await fulfillPaidPayment(input);
    const afterSecond = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });

    assert.equal(first.ok && first.already, false);
    assert.equal(second.ok && second.already, true);
    assert.equal(paid.status, "paid");
    assert.equal(afterFirst.featured, true);
    assert.equal(afterSecond.featuredUntil?.toISOString(), sentinel.toISOString());
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("fulfill turns on Verified Pro once and rejects a mismatched amount", async () => {
  const { user, listing, stamp } = await fixture();
  try {
    const good = await prisma.payment.create({
      data: {
        userId: user.id,
        listingId: null,
        product: "verified_pro",
        method: "card",
        amount: "KES 2,500",
        amountValue: 2500,
        currency: "KES",
        reference: `dala_test_pro_${stamp}`,
        provider: "flutterwave",
        status: "pending",
      },
    });
    const bad = await prisma.payment.create({
      data: {
        userId: user.id,
        listingId: listing.id,
        product: "featured",
        method: "mpesa",
        amount: "KES 1,500",
        amountValue: 1500,
        currency: "KES",
        reference: `dala_test_bad_${stamp}`,
        provider: "flutterwave",
        status: "pending",
      },
    });

    const paid = await fulfillPaidPayment({
      reference: good.reference,
      providerId: "100",
      amount: 2500,
      currency: "kes",
      method: "card",
      testMode: false,
    });
    const mismatch = await fulfillPaidPayment({
      reference: bad.reference,
      providerId: "101",
      amount: 1,
      currency: "KES",
      method: "mpesa",
      testMode: true,
    });
    const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const listingAfter = await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
    const badAfter = await prisma.payment.findUniqueOrThrow({ where: { id: bad.id } });

    assert.equal(paid.ok && paid.already, false);
    assert.equal(userAfter.verifiedPro, true);
    assert.equal(mismatch.ok, false);
    assert.equal(badAfter.status, "failed");
    assert.equal(listingAfter.featured, false);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

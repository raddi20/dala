import assert from "node:assert/strict";
import test from "node:test";
import { PRO_DAYS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { fulfillPaidPayment } from "@/lib/payments/fulfill";

const DAY_MS = 86_400_000;

function aboutDaysAfter(from: Date, days: number, actual: Date | null) {
  assert.ok(actual);
  const expected = from.getTime() + days * DAY_MS;
  assert.ok(
    Math.abs(actual.getTime() - expected) < 15_000,
    `${actual.toISOString()} is not ${days} days after ${from.toISOString()}`,
  );
}

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
    aboutDaysAfter(new Date(), PRO_DAYS, userAfter.verifiedProUntil);
    assert.equal(mismatch.ok, false);
    assert.equal(badAfter.status, "failed");
    assert.equal(listingAfter.featured, false);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("a Pro payment starts 30 days from now, and a repeat of that payment does not add them again", async () => {
  const { user, stamp } = await fixture();
  try {
    const past = new Date(Date.now() - 10 * DAY_MS);
    await prisma.user.update({
      where: { id: user.id },
      data: { verifiedPro: true, verifiedProUntil: past },
    });
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        product: "verified_pro",
        method: "mpesa",
        amount: "KES 2,500",
        amountValue: 2500,
        currency: "KES",
        reference: `dala_test_pro_now_${stamp}`,
        provider: "flutterwave",
        status: "pending",
      },
    });
    const input = {
      reference: payment.reference,
      providerId: "210",
      amount: 2500,
      currency: "KES",
      method: "mpesa" as const,
      testMode: true,
    };
    const started = Date.now();
    const first = await fulfillPaidPayment(input);
    const afterFirst = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const sentinel = new Date("2031-06-01T00:00:00.000Z");
    await prisma.user.update({ where: { id: user.id }, data: { verifiedProUntil: sentinel } });
    const second = await fulfillPaidPayment(input);
    const afterSecond = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    assert.equal(first.ok && first.already, false);
    assert.equal(second.ok && second.already, true);
    aboutDaysAfter(new Date(started), PRO_DAYS, afterFirst.verifiedProUntil);
    assert.equal(afterSecond.verifiedPro, true);
    assert.equal(afterSecond.verifiedProUntil?.toISOString(), sentinel.toISOString());
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("a Pro payment while the plan is still running adds 30 days to the current end date", async () => {
  const { user, stamp } = await fixture();
  try {
    const future = new Date(Date.now() + 12 * DAY_MS);
    await prisma.user.update({
      where: { id: user.id },
      data: { verifiedPro: true, verifiedProUntil: future },
    });
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        product: "verified_pro",
        method: "card",
        amount: "£20",
        amountValue: 20,
        currency: "GBP",
        reference: `dala_test_pro_extend_${stamp}`,
        provider: "flutterwave",
        status: "pending",
      },
    });
    const paid = await fulfillPaidPayment({
      reference: payment.reference,
      providerId: "211",
      amount: 20,
      currency: "GBP",
      method: "card",
      testMode: true,
    });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(paid.ok && paid.already, false);
    assert.equal(after.verifiedPro, true);
    aboutDaysAfter(future, PRO_DAYS, after.verifiedProUntil);
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
  }
});

/**
 * Local shop used by layout checks and screenshots.
 * Refuses anything that is not a SQLite file, so it cannot write a hosted database.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (process.env.VERCEL === "1" || !url.startsWith("file:")) {
  console.error("Refusing community fixture: database is not a local file.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
const passwordHash = await bcrypt.hash("demo1234", 10);
const now = new Date();
const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
const photo = "https://images.unsplash.com/photo-1510130387422-82bed34b37e9?auto=format&fit=crop&w=1200&q=80";

const seller = await prisma.user.upsert({
  where: { email: "nyangoma@example.com" },
  update: { name: "Nyangoma Fresh Fish", passwordHash, role: "user", city: "Kisumu", suspended: false },
  create: {
    id: "fixture_seller_nyangoma",
    email: "nyangoma@example.com",
    name: "Nyangoma Fresh Fish",
    passwordHash,
    role: "user",
    kind: "business",
    city: "Kisumu",
    phone: "+254712000221",
    whatsapp: "+254712000221",
    bio: "Fresh fish from the lake, every morning.",
  },
});

const buyer = await prisma.user.upsert({
  where: { email: "achieng.buyer@example.com" },
  update: { name: "Achieng Buyer", passwordHash, role: "user", suspended: false, followDigestOptOut: false },
  create: {
    id: "fixture_buyer_achieng",
    email: "achieng.buyer@example.com",
    name: "Achieng Buyer",
    passwordHash,
    role: "user",
    kind: "person",
    city: "Nairobi",
    bio: "",
  },
});

await prisma.user.upsert({
  where: { email: "community.admin@example.com" },
  update: { name: "Community Admin", passwordHash, role: "admin", suspended: false },
  create: {
    id: "fixture_admin_community",
    email: "community.admin@example.com",
    name: "Community Admin",
    passwordHash,
    role: "admin",
    kind: "person",
    city: "Nairobi",
    bio: "Reviews shop updates on the local fixture.",
  },
});

const shop = await prisma.storefront.upsert({
  where: { slug: "nyangoma-fish" },
  update: { published: true, hidden: false, userId: seller.id },
  create: {
    id: "fixture_shop_nyangoma",
    userId: seller.id,
    slug: "nyangoma-fish",
    published: true,
    bannerUrl: photo,
  },
});

await prisma.offering.upsert({
  where: { id: "fixture_offering_omena" },
  update: { title: "Omena, a cup", hidden: false, archived: false },
  create: {
    id: "fixture_offering_omena",
    storefrontId: shop.id,
    title: "Omena, a cup",
    description: "A cup of omena, fried or fresh.",
    priceCents: 20000,
    currency: "KES",
    imageUrl: photo,
  },
});

await prisma.listing.upsert({
  where: { id: "fixture_listing_tilapia" },
  update: { hidden: false, title: "Whole tilapia, this morning", ownerId: seller.id },
  create: {
    id: "fixture_listing_tilapia",
    type: "business",
    title: "Whole tilapia, this morning",
    description: "Caught this morning. Ask on the shop page.",
    category: "Butchery & fish",
    city: "Kisumu",
    region: "homeland",
    priceLabel: "Ksh 200",
    photoUrl: photo,
    contactName: "Nyangoma Fresh Fish",
    contactPhone: "+254712000221",
    contactWhatsapp: "+254712000221",
    ownerId: seller.id,
    scamRisk: "low",
  },
});

await prisma.shopUpdate.upsert({
  where: { id: "fixture_update_omena" },
  update: { status: "approved", body: "Omena is in. Come by before noon.", expiresAt: expires, photoUrl: photo },
  create: {
    id: "fixture_update_omena",
    storefrontId: shop.id,
    authorId: seller.id,
    body: "Omena is in. Come by before noon.",
    photoUrl: photo,
    status: "approved",
    expiresAt: expires,
  },
});

await prisma.shopUpdate.upsert({
  where: { id: "fixture_update_held" },
  update: { status: "pending", holdReason: "Held for a moderator.", expiresAt: expires },
  create: {
    id: "fixture_update_held",
    storefrontId: shop.id,
    authorId: seller.id,
    body: "New basket this week. Please take a look before it goes on the shop.",
    status: "pending",
    holdReason: "Held for a moderator.",
    expiresAt: expires,
  },
});

await prisma.shopUpdate.upsert({
  where: { id: "fixture_update_held_reject" },
  update: { status: "pending", holdReason: "Held for a moderator.", expiresAt: expires },
  create: {
    id: "fixture_update_held_reject",
    storefrontId: shop.id,
    authorId: seller.id,
    body: "Tilapia is plentiful this week. Come by the stall before noon.",
    status: "pending",
    holdReason: "Held for a moderator.",
    expiresAt: expires,
  },
});

await prisma.shopUpdate.upsert({
  where: { id: "fixture_update_held_remove" },
  update: { status: "pending", holdReason: "Held for a moderator.", expiresAt: expires },
  create: {
    id: "fixture_update_held_remove",
    storefrontId: shop.id,
    authorId: seller.id,
    body: "We open early on Saturday for the market rush.",
    status: "pending",
    holdReason: "Held for a moderator.",
    expiresAt: expires,
  },
});

await prisma.shopFollow.upsert({
  where: { userId_shopId: { userId: buyer.id, shopId: shop.id } },
  update: {},
  create: { id: "fixture_follow_achieng", userId: buyer.id, shopId: shop.id },
});

// A tall /listings grid so the dock is checked while cards scroll through it.
const stalls = [
  "Awuor Textiles",
  "Odhiambo Joinery",
  "Anyango Catering",
  "Ochieng Hardware",
  "Adhiambo Braids",
  "Okello Boda",
  "Akinyi Baskets",
  "Omondi Repairs",
];
for (let i = 0; i < stalls.length; i += 1) {
  const name = stalls[i];
  const when = new Date(now.getTime() - i * 1000);
  const phone = `+25471110010${i}`;
  const sellerId = `fixture_grid_user_${i}`;
  const gridSeller = await prisma.user.upsert({
    where: { email: `grid-stall-${i}@example.com` },
    update: { name, passwordHash, role: "user", city: "Kisumu", suspended: false, phone, whatsapp: phone },
    create: {
      id: sellerId,
      email: `grid-stall-${i}@example.com`,
      name,
      passwordHash,
      role: "user",
      kind: "business",
      city: "Kisumu",
      phone,
      whatsapp: phone,
      bio: `${name} on the grid fixture.`,
    },
  });
  await prisma.storefront.upsert({
    where: { slug: `grid-stall-${i}` },
    update: { published: true, hidden: false, userId: gridSeller.id, createdAt: when },
    create: {
      id: `fixture_grid_shop_${i}`,
      userId: gridSeller.id,
      slug: `grid-stall-${i}`,
      published: true,
      bannerUrl: photo,
      createdAt: when,
    },
  });
  await prisma.listing.upsert({
    where: { id: `fixture_grid_listing_${i}` },
    update: {
      hidden: false,
      title: `${name}, this week`,
      ownerId: gridSeller.id,
      priceLabel: "Ksh 450",
      createdAt: new Date(when.getTime() - 60_000),
    },
    create: {
      id: `fixture_grid_listing_${i}`,
      type: "business",
      title: `${name}, this week`,
      description: "Ask on WhatsApp.",
      category: "Butchery & fish",
      city: "Kisumu",
      region: "homeland",
      priceLabel: "Ksh 450",
      photoUrl: photo,
      contactName: name,
      contactPhone: phone,
      contactWhatsapp: phone,
      ownerId: gridSeller.id,
      scamRisk: "low",
      createdAt: new Date(when.getTime() - 60_000),
    },
  });
}

console.log("Community fixture ready: /b/nyangoma-fish");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

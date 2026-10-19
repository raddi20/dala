import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { regionForCity } from "../src/lib/constants";

const prisma = new PrismaClient();
const email = "tour-visual@example.com";

const passwordHash = await bcrypt.hash("tour-visual-pass", 8);
const user = await prisma.user.upsert({
  where: { email },
  update: { suspended: false },
  create: {
    email,
    name: "Achieng Otieno",
    passwordHash,
    city: "Kisumu",
    phone: "+254712000321",
    whatsapp: "+254712000321",
    bio: "Sells fresh tilapia in Kisumu.",
  },
});

const title = "Fresh tilapia in Kisumu";
const existing = await prisma.listing.findFirst({ where: { ownerId: user.id, title } });
if (!existing) {
  await prisma.listing.create({
    data: {
      type: "for_sale",
      title,
      description: "Fresh tilapia from Kisumu, messaged on WhatsApp.",
      category: "Food & restaurants",
      city: "Kisumu",
      region: regionForCity("Kisumu"),
      priceLabel: "KES 800",
      contactName: user.name,
      contactPhone: user.phone,
      contactWhatsapp: user.whatsapp,
      ownerId: user.id,
    },
  });
}

console.log("tour fixture ready", email);
await prisma.$disconnect();

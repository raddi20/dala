import { PrismaClient } from "@prisma/client";
import { ensureOccasionDefinitions } from "../src/lib/occasions";

const prisma = new PrismaClient();

try {
  const result = await ensureOccasionDefinitions(prisma);
  if (result.created.length === 0) {
    console.log("Occasion pages already exist. Left titles and intros as they are.");
  } else {
    console.log(`Added occasion pages: ${result.created.join(", ")}`);
  }
} finally {
  await prisma.$disconnect();
}

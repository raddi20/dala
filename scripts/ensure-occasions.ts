import { PrismaClient } from "@prisma/client";
import { ensureOccasionDefinitions } from "../src/lib/occasions";

const prisma = new PrismaClient();

ensureOccasionDefinitions(prisma)
  .then((result) => {
    if (result.created.length === 0) {
      console.log("Occasion pages already exist. Left titles and intros as they are.");
    } else {
      console.log(`Added occasion pages: ${result.created.join(", ")}`);
    }
  })
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

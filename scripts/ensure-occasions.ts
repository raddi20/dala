import { PrismaClient } from "@prisma/client";
import { ensureOccasionDefinitions } from "../src/lib/occasions";

const prisma = new PrismaClient();

ensureOccasionDefinitions(prisma)
  .then((result) => {
    if (result.created.length === 0 && result.updated.length === 0) {
      console.log("Occasion pages already exist. Left titles and intros as they are.");
    } else {
      if (result.created.length > 0) console.log(`Added occasion pages: ${result.created.join(", ")}`);
      if (result.updated.length > 0) console.log(`Updated occasion intros: ${result.updated.join(", ")}`);
    }
  })
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

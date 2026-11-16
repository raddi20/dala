import { PrismaClient } from "@prisma/client";
import { ensureSeedRecruiter } from "../src/lib/recruiter";

const prisma = new PrismaClient();

async function main() {
  const { created } = await ensureSeedRecruiter(prisma);
  if (created) {
    console.log("Created recruiter irene (Irene), active.");
  } else {
    console.log("Recruiter irene already exists. Name and active flag were left as they are.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import {
  ADMIN_ACCOUNT_CITY,
  ADMIN_ACCOUNT_NAME,
  planSecureAccounts,
  type SecurePlan,
} from "../src/lib/admin-access";

const prisma = new PrismaClient();

async function applySecurePlan(plan: SecurePlan, claimSecret: string) {
  if (plan.fatal) {
    throw new Error("Refusing to apply a plan that failed checks.");
  }

  for (const id of plan.lockIds) {
    const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
    await prisma.user.update({
      where: { id },
      data: { role: "user", passwordHash },
    });
  }
  if (!plan.production) {
    console.log("Not a production deploy. Demo passwords and admin roles were left unchanged.");
    return;
  }
  if (plan.lockIds.length > 0) {
    console.log(
      `Locked ${plan.lockIds.length} @dala.local demo account(s): removed admin role and replaced the password hash.`,
    );
  } else {
    console.log("No @dala.local demo accounts to lock.");
  }

  if (!plan.adminConfigured) {
    console.log("ADMIN_EMAIL is unset. No admin account was created or promoted.");
    return;
  }

  const passwordHash = await bcrypt.hash(claimSecret.trim(), 10);
  for (const claim of plan.claims) {
    if (claim.action === "create") {
      await prisma.user.create({
        data: {
          email: claim.email,
          name: ADMIN_ACCOUNT_NAME,
          passwordHash,
          role: "admin",
          kind: "person",
          city: ADMIN_ACCOUNT_CITY,
        },
      });
      console.log(`Created admin ${claim.email}. Sign in with ADMIN_CLAIM_SECRET as the password.`);
      continue;
    }
    if (!claim.userId) continue;
    if (claim.action === "claim" || claim.action === "reset") {
      await prisma.user.update({
        where: { id: claim.userId },
        data: { email: claim.email, role: "admin", passwordHash },
      });
      const verb = claim.action === "reset" ? "Reset the password for" : "Granted admin to";
      console.log(`${verb} ${claim.email}. Sign in with ADMIN_CLAIM_SECRET as the password.`);
      continue;
    }
    if (claim.action === "normalize-email") {
      await prisma.user.update({
        where: { id: claim.userId },
        data: { email: claim.email },
      });
      console.log(`Normalized the email on admin ${claim.email}. Password and role were left unchanged.`);
      continue;
    }
    console.log(`Admin ${claim.email} already exists. Password and profile were left unchanged.`);
  }
}

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true },
  });
  const plan = planSecureAccounts(users, process.env);
  if (plan.fatal) {
    console.error(plan.fatal);
    process.exitCode = 1;
    return;
  }
  await applySecurePlan(plan, process.env.ADMIN_CLAIM_SECRET ?? "");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

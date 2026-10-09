import { referralForNewAccount } from "@/lib/agent-code";

export type NewAccountInput = {
  name: string;
  email: string;
  passwordHash: string;
  kind: string;
  city: string;
  agentCookie: string | null | undefined;
  now?: Date;
};

type CreatedUser = { id: string; referralAgentCode: string | null };

export type RegisterUserDb = {
  findByEmail: (email: string) => Promise<{ referralAgentCode: string | null } | null>;
  create: (data: {
    name: string;
    email: string;
    passwordHash: string;
    kind: string;
    city: string;
    referralAgentCode: string | null;
    referralAgentAt: Date | null;
  }) => Promise<CreatedUser>;
};

/**
 * Inserts one account. A duplicate email is refused and the existing row is not written,
 * so a brochure code already stored on that person stays as it is.
 */
export async function createRegisteredUser(
  db: RegisterUserDb,
  input: NewAccountInput,
): Promise<{ ok: true; id: string; referralAgentCode: string | null } | { ok: false; error: string }> {
  const existing = await db.findByEmail(input.email);
  if (existing) return { ok: false, error: "That email is already registered." };

  const referral = referralForNewAccount(input.agentCookie, input.now);
  const user = await db.create({
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    kind: input.kind,
    city: input.city,
    referralAgentCode: referral.referralAgentCode,
    referralAgentAt: referral.referralAgentAt,
  });
  return { ok: true, id: user.id, referralAgentCode: user.referralAgentCode };
}

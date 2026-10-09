/** Off unless PAYMENTS_LIVE is 1, true, yes, or on. Checkout code stays in place. */
export const PAID_UPGRADES_COMING_SOON = "Paid upgrades coming soon";

const ON = new Set(["1", "true", "yes", "on"]);

export function paymentsLive(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = (env.PAYMENTS_LIVE ?? "").trim().toLowerCase();
  return ON.has(value);
}

/** Null when checkout may start. Otherwise the message to show and return from the pay action. */
export function checkoutRefusal(env: NodeJS.ProcessEnv = process.env): string | null {
  if (paymentsLive(env)) return null;
  return PAID_UPGRADES_COMING_SOON;
}

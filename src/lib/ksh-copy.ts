/**
 * Buyer-facing shilling words. Stored amounts, checkout, and APIs keep the code KES.
 * "KSh" and "KES" in a price are shown as "Ksh".
 */
export function asKshCopy(text: string): string {
  return text.replace(/\bKSh\b/g, "Ksh").replace(/\bKES\b/g, "Ksh");
}

export function kshAmount(amount: string | number): string {
  return `Ksh ${amount}`;
}

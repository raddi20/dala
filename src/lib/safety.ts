/** Shown beside WhatsApp and call buttons. */
export const MPESA_SAFETY_NOTE = "Never send an M-Pesa deposit before you've confirmed the seller.";

export const SAFETY_TIPS = [
  {
    title: "Confirm the seller first",
    body: "A call, a visit, or the Phone verified badge on the shop is the check. Do not send a deposit, a booking fee, or a transport fee before that.",
  },
  {
    title: "Pay the number on the shop",
    body: "Use the phone number shown on the shop. If someone sends a different till, paybill, or number, stop and ask why.",
  },
  {
    title: "The money stays with the seller",
    body: "{name} does not hold the money for goods. Payment stays between you and the seller. If a deal feels wrong, don't pay, and report the shop.",
  },
] as const;

export function safetyTipText(body: string, name: string) {
  return body.replaceAll("{name}", name);
}

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

/** What a shop badge means on {name}. Honest limits, no guarantees. */
export const VERIFICATION_EXPLAINER = {
  intro:
    "Badges are checks an admin did by call, video, visit, or by looking at documents. They help you decide who to talk to. They are not a promise about every sale.",
  points: [
    { label: "Phone verified", body: "An admin reached the seller on the phone number shown on the shop." },
    { label: "Location verified", body: "An admin confirmed where the shop or seller is based." },
    { label: "Business verified", body: "An admin confirmed this is a real, working business." },
  ],
  limits: [
    "A badge does not check the goods, the price, or the delivery date. Ask for photos and agree the details before you pay.",
    "Pro plan and Featured are paid placements. They are not verification badges.",
    "A shop with no badge is not a scam. It has not been checked yet, so confirm it yourself first.",
  ],
} as const;

/** Practical M-Pesa tips for buyers and sellers. Payment stays between buyer and seller. */
export const MPESA_TIPS = {
  buyers: [
    "Check that the name M-Pesa shows on the confirm screen matches the shop name or the seller you spoke to.",
    "Pay the till, paybill, or number shown on the shop. If you are asked to pay a different number, stop and ask why.",
    "For a big order, such as dowry or ayie catering, agree the menu, date, and amount in WhatsApp first, then pay a part and the rest on delivery.",
    "For a fundi job, pay for materials or the first stage, see the work, then pay the balance.",
    "Keep the M-Pesa confirmation SMS until the deal is done.",
  ],
  sellers: [
    "Only count money that shows in your own M-Pesa app or statement. A forwarded SMS or a screenshot is not payment.",
    "If a buyer says they sent too much and asks for a refund, check your M-Pesa balance first. Do not send money back from a message alone.",
    "Never share your M-Pesa PIN or a code sent to your phone, even with someone who says they are from Safaricom or {name}.",
    "For fresh stock, such as tilapia from the lake, confirm payment before the goods leave you, or agree to collect on delivery.",
  ],
} as const;

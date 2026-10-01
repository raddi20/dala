import type { Prisma } from "@prisma/client";

export const DIASPORA_ORDERS_LABEL = "Serves diaspora orders";

export const DIASPORA_ORDERS_EXPLANATION =
  "This shop takes WhatsApp orders from people abroad for family at home. Payment stays between you and the seller.";

export function wantsDiasporaOrders(value: string | boolean | null | undefined) {
  return value === true || value === "1" || value === "true";
}

/** Listings whose shop has opted in. Shops without the flag, and listings with no shop, stay out. */
export function diasporaOrdersWhere(value: string | boolean | null | undefined): Prisma.ListingWhereInput | null {
  if (!wantsDiasporaOrders(value)) return null;
  return { owner: { storefront: { is: { servesDiaspora: true } } } };
}

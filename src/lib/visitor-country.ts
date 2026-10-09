import { countryCode } from "@/lib/visitor-currency";

/** Vercel sets this on the request. Missing or unreadable means we show the real charges. */
export async function readVisitorCountry(): Promise<string | null> {
  try {
    const { headers } = await import("next/headers");
    const bag = await headers();
    return countryCode(bag.get("x-vercel-ip-country"));
  } catch {
    return null;
  }
}

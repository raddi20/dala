/**
 * The caller hashes this before anything is stored. Do not log or persist the return value.
 */
export async function clientAddress(): Promise<string> {
  try {
    const { headers } = await import("next/headers");
    const bag = await headers();
    const forwarded = bag.get("x-forwarded-for") ?? "";
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first) return first.slice(0, 80);
    return (bag.get("x-real-ip")?.trim() ?? "unknown").slice(0, 80) || "unknown";
  } catch {
    return "unknown";
  }
}

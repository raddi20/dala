/** Weak-data (lite) mode: smaller photos. On when the browser sends Save-Data, or the visitor turned it on. */
export const LITE_COOKIE = "rangach_lite";

export function liteFrom(input: { saveData?: string | null; cookie?: string | null; ect?: string | null }): boolean {
  if (input.cookie === "0") return false;
  if (input.cookie === "1") return true;
  if ((input.saveData ?? "").trim().toLowerCase() === "on") return true;
  return ["slow-2g", "2g"].includes((input.ect ?? "").trim().toLowerCase());
}

/** Server components only. */
export async function liteMode(): Promise<boolean> {
  try {
    const { cookies, headers } = await import("next/headers");
    const [jar, bag] = await Promise.all([cookies(), headers()]);
    return liteFrom({ saveData: bag.get("save-data"), cookie: jar.get(LITE_COOKIE)?.value, ect: bag.get("ect") });
  } catch {
    return false;
  }
}

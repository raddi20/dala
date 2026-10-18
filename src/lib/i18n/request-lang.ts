import { cookies } from "next/headers";
import { LANG_COOKIE, langFromCookie, type Lang } from "@/lib/i18n/lang";

/** English when the flag is off or the device has no choice yet. */
export async function requestLang(): Promise<Lang> {
  const jar = await cookies();
  return langFromCookie(jar.get(LANG_COOKIE)?.value);
}

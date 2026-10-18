export const LANG_COOKIE = "rangach_lang";

export type Lang = "en" | "dholuo";

const ON = new Set(["1", "true", "yes", "on"]);

/** Off unless NEXT_PUBLIC_DHOLUO_UI is 1, true, yes, or on. */
export function dholuoUiOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return ON.has((env.NEXT_PUBLIC_DHOLUO_UI ?? "").trim().toLowerCase());
}

/** Cookie wins only while the flag is on. Missing or unknown values stay English. */
export function langFromCookie(value: string | undefined | null, env: NodeJS.ProcessEnv = process.env): Lang {
  if (!dholuoUiOn(env)) return "en";
  return value === "dholuo" ? "dholuo" : "en";
}

/** One year, site-wide. Not HttpOnly, so the toggle can write it and the server can read it. */
export function persistLangCookie(lang: Lang): string {
  return `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function readLangCookie(header: string): string {
  const parts = header.split(";").map((part) => part.trim());
  const pair = parts.find((part) => part.startsWith(`${LANG_COOKIE}=`));
  return pair ? pair.slice(LANG_COOKIE.length + 1) : "";
}

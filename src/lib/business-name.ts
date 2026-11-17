/**
 * A username-style handle: one lowercase token with a digit or an underscore, such as kevo_254.
 * "Akinyi Catering" and "mama" are not handles.
 */
export function looksLikeUsername(name: string): boolean {
  const value = name.trim();
  if (value.length < 3 || /\s/.test(value)) return false;
  if (value !== value.toLowerCase()) return false;
  return /[0-9_]/.test(value);
}

/** Turns "kevo_254 fish" into "Kevo Fish". Leaves a name that is already words alone apart from capital letters. */
export function tidyBusinessName(raw: string): string {
  const cleaned = raw
    .replace(/[_]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^\p{L}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((word) => word.length > 1).slice(0, 6);
  if (words.length === 0) return "";
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 80);
}

/** Prefer a tidy name. A handle is replaced from the fallback (usually the listing title or the seller's sentence). */
export function suggestBusinessName(preferred: string, fallback: string): string {
  const primary = preferred.trim();
  const source = !primary || looksLikeUsername(primary) ? fallback : primary;
  const tidy = tidyBusinessName(source);
  if (tidy && !looksLikeUsername(tidy)) return tidy;
  const fromFallback = tidyBusinessName(fallback);
  if (fromFallback && !looksLikeUsername(fromFallback)) return fromFallback;
  return tidy || "New business";
}

import { appName } from "@/lib/brand";
import type { Lang } from "@/lib/i18n/lang";
import { UI_STRINGS } from "@/lib/i18n/strings";
import { waMeDigits } from "@/lib/phone";

function waMe(phone: string, text: string) {
  const digits = waMeDigits(phone);
  const query = `?text=${encodeURIComponent(text)}`;
  if (digits) return `https://wa.me/${digits}${query}`;
  // A share link has no seller number. A typed number that is not E.164 must not become wa.me/07…
  if (phone.trim()) return "";
  return `https://wa.me/${query}`;
}

/** Opens WhatsApp with an exact message. Nothing is stored. */
export function whatsappPrefillLink(phone: string, text: string) {
  return waMe(phone, text);
}

/**
 * The one-tap buyer message: "Hi, I found you on Rangach – is this still available? <title> <link>".
 * Dholuo buyers get Kevin's signed-off Dholuo line.
 */
export function whatsappFoundYouText(item: { title: string; url: string }, lang: Lang = "en") {
  const row = UI_STRINGS.wa_found_you;
  const template = lang === "dholuo" && !row.draft ? row.dholuo : row.en;
  const subject = [item.title.trim(), item.url.trim()].filter(Boolean).join(" ");
  return template.replace("{app}", appName()).replace("{item}", subject).trim();
}

/** One-tap WhatsApp to the seller with the found-you message prefilled. */
export function whatsappFoundYouLink(phone: string, item: { title: string; url: string }, lang: Lang = "en") {
  return waMe(phone, whatsappFoundYouText(item, lang));
}

export function whatsappChatLink(phone: string, title: string, url = "", lang: Lang = "en") {
  return whatsappFoundYouLink(phone, { title, url }, lang);
}

export function whatsappShareLink(title: string, url: string) {
  return waMe("", `${title}\n${url}\nShared from ${appName()}`);
}

export function whatsappShopLink(phone: string, url: string, name = "", lang: Lang = "en") {
  return whatsappFoundYouLink(phone, { title: name, url }, lang);
}

export function whatsappOfferingText(offering: string, url: string) {
  return `Hi, I saw ${offering} on your ${appName()} shop (${url})…`;
}

export function whatsappOfferingLink(phone: string, offering: string, url: string) {
  return waMe(phone, whatsappOfferingText(offering, url));
}

import { appName } from "@/lib/brand";
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

export function whatsappChatLink(phone: string, title: string) {
  return waMe(phone, `Hello, I found ${title} on ${appName()}.`);
}

export function whatsappShareLink(title: string, url: string) {
  return waMe("", `${title}\n${url}\nShared from ${appName()}`);
}

export function whatsappShopLink(phone: string, url: string) {
  return waMe(phone, `Hi, I saw your ${appName()} shop (${url})…`);
}

export function whatsappOfferingText(offering: string, url: string) {
  return `Hi, I saw ${offering} on your ${appName()} shop (${url})…`;
}

export function whatsappOfferingLink(phone: string, offering: string, url: string) {
  return waMe(phone, whatsappOfferingText(offering, url));
}

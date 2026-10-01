import { appName } from "@/lib/brand";

function waMe(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
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

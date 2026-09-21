import { APP_NAME } from "@/lib/brand";

function waMe(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function whatsappChatLink(phone: string, title: string) {
  return waMe(phone, `Hello, I found ${title} on ${APP_NAME}.`);
}

export function whatsappShareLink(title: string, url: string) {
  return waMe("", `${title}\n${url}\nShared from ${APP_NAME}`);
}

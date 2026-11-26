/**
 * Sentences built only from fields the caller passes in.
 * A blank field is left out. Nothing here is a review, a rating, or a price we made up.
 */
import { asKshCopy } from "@/lib/ksh-copy";

const FUNERAL_WORD = /funeral|burial/i;

export function countNoun(count: number, singular: string, plural: string) {
  const amount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
  return `${amount} ${amount === 1 ? singular : plural}`;
}

/** Category labels that would put a funeral word into a sentence we write. */
export function sentenceCategory(category: string) {
  const value = category.trim();
  if (!value || FUNERAL_WORD.test(value)) return "";
  return value;
}

/**
 * A seller's price text. A bare number is shown as shillings.
 * The word KES in a stored label is shown as Ksh. An empty price stays empty.
 */
export function shownPriceLabel(priceLabel: string) {
  const text = priceLabel.trim();
  if (!text) return "";
  if (/[A-Za-z£$€]/.test(text)) return asKshCopy(text);
  if (/^\d[\d,.\s]*$/.test(text)) return `Ksh ${text}`;
  return text;
}

export function shopAboutFallback(input: {
  name: string;
  category: string;
  town: string;
  listingCount: number;
  siteName: string;
}) {
  const name = input.name.trim();
  const category = sentenceCategory(input.category);
  const town = input.town.trim();
  const site = input.siteName.trim();
  const kind = category ? `a ${category} business` : "a business";
  const place = town ? ` in ${town}` : "";
  const on = site ? ` on ${site}` : "";
  return `${name} is ${kind}${place}${on} with ${countNoun(input.listingCount, "listing", "listings")}.`;
}

export function shopPageTitle(input: { name: string; category: string; town: string }) {
  const parts = [input.name.trim()];
  const category = sentenceCategory(input.category);
  const town = input.town.trim();
  if (category) parts.push(category);
  if (town) parts.push(town);
  return parts.filter(Boolean).join(" · ");
}

export function listingPageTitle(input: { title: string; category: string; city: string }) {
  const parts = [input.title.trim()];
  const category = sentenceCategory(input.category);
  const city = input.city.trim();
  if (category && category !== parts[0]) parts.push(category);
  if (city && city !== parts[0]) parts.push(city);
  return parts.filter(Boolean).join(" · ");
}

export function listingDetailsSentence(input: {
  title: string;
  category: string;
  city: string;
  siteName: string;
  sellerName: string;
  priceLabel: string;
}) {
  const title = input.title.trim();
  const category = sentenceCategory(input.category);
  const city = input.city.trim();
  const site = input.siteName.trim();
  const seller = input.sellerName.trim();
  const price = shownPriceLabel(input.priceLabel);
  let sentence = title || "This listing";
  sentence += category ? ` is a ${category} listing` : " is a listing";
  if (city) sentence += ` in ${city}`;
  if (site) sentence += ` on ${site}`;
  sentence += ".";
  if (seller) sentence += ` Listed by ${seller}.`;
  if (price) sentence += ` Price: ${price}.`;
  return sentence;
}

export function hubIntro(input: { placeName: string; siteName: string; shopCount: number; listingCount: number }) {
  const place = input.placeName.trim();
  const site = input.siteName.trim();
  const shops = countNoun(input.shopCount, "shop", "shops");
  const listings = countNoun(input.listingCount, "listing", "listings");
  const on = site ? ` on ${site}` : "";
  return `${place}${on} has ${shops} and ${listings}.`;
}

export function hubSampleLine(titles: readonly string[]) {
  const clean = titles.map((title) => title.trim()).filter(Boolean).slice(0, 3);
  if (clean.length === 0) return "";
  return `Listings include ${clean.join(", ")}.`;
}

export function hubDescription(input: {
  placeName: string;
  siteName: string;
  shopCount: number;
  listingCount: number;
  sampleTitles?: readonly string[];
}) {
  const sample = hubSampleLine(input.sampleTitles ?? []);
  const intro = hubIntro(input);
  return sample ? `${intro} ${sample}` : intro;
}

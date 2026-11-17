import { suggestBusinessName } from "@/lib/business-name";
import { parseNlQuery } from "@/lib/nl-query";

export function draftListing(prompt: string) {
  const clean = prompt.trim().replace(/\s+/g, " ");
  if (clean.length < 8) {
    return {
      title: "",
      description: "",
      category: "",
      type: "",
      city: "",
      businessName: "",
      note: "",
      error: "Write a short sentence first, for example: Braiding salon in Tottenham.",
    };
  }

  const parsed = parseNlQuery(clean);
  const sentence = clean.split(/[.!?,]/)[0] ?? clean;
  const title = sentence
    .split(" ")
    .slice(0, 8)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 80);
  const city = parsed.city || "Nairobi";
  const ending = /[.!?]$/.test(clean) ? "" : ".";
  const description = `${clean.charAt(0).toUpperCase()}${clean.slice(1)}${ending}\n\nBased in ${city}. Message on WhatsApp to ask about availability and prices.\n\nThis draft was written by the listing assist. Check it, then publish.`;

  const businessName = suggestBusinessName(title, clean);
  return {
    title: title || "New listing",
    description,
    category: parsed.category || "Retail / shops",
    type: parsed.type || "business",
    city,
    businessName,
    note: businessName
      ? `Suggestion only. Business name: ${businessName}. Read as: ${parsed.summary}`
      : `Suggestion only. Read as: ${parsed.summary}`,
    error: "",
  };
}

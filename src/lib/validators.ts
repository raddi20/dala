import { parsePrice } from "@/lib/price";
import { z } from "zod";
import {
  CATEGORIES,
  CITIES,
  canonicalCity,
  isCategory,
  isCityName,
  isOfferingCurrency,
  REPORT_REASONS,
} from "@/lib/constants";
import { normalizeContactPair } from "@/lib/phone";

export type ActionState = { error: string; ok?: boolean; message?: string; field?: string };

export function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const phoneText = z.string().trim().max(48, "That number is too long.").default("");

export const listingSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(80),
  description: z.string().trim().min(10, "Description must be at least 10 characters.").max(4000),
  category: z.string().refine(isCategory, "Choose a category."),
  city: z.string().refine(isCityName, "Choose a city."),
  type: z.enum(["business", "for_sale", "wanted", "housing", "services"]),
  address: z.string().trim().max(160).default(""),
  priceLabel: z.string().trim().max(40).default(""),
  contactName: z.string().trim().max(80).default(""),
  contactPhone: phoneText,
  contactWhatsapp: phoneText,
  photoUrl: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "Photo URL must start with http:// or https://.",
    ),
});

export function parseListingForm(formData: FormData) {
  const parsed = listingSchema.safeParse({
    title: field(formData, "title"),
    description: field(formData, "description"),
    category: field(formData, "category"),
    city: field(formData, "city"),
    type: field(formData, "type"),
    address: field(formData, "address"),
    priceLabel: field(formData, "priceLabel"),
    contactName: field(formData, "contactName"),
    contactPhone: field(formData, "contactPhone"),
    contactWhatsapp: field(formData, "contactWhatsapp"),
    photoUrl: field(formData, "photoUrl"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const phones = normalizeContactPair({
    phone: parsed.data.contactPhone,
    whatsapp: parsed.data.contactWhatsapp,
    city: parsed.data.city,
  });
  if (!phones.ok) {
    return {
      ok: false as const,
      error: phones.error,
      field: phones.field === "phone" ? "contactPhone" : "contactWhatsapp",
    };
  }
  return {
    ok: true as const,
    data: { ...parsed.data, contactPhone: phones.phone, contactWhatsapp: phones.whatsapp },
  };
}

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  kind: z.enum(["person", "business"]),
  city: z.string().refine(isCityName, "Choose a city."),
  bio: z.string().trim().max(500).default(""),
  phone: phoneText,
  whatsapp: phoneText,
  avatarUrl: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "Photo URL must start with http:// or https://.",
    ),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email.").max(120),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20, "This link is not valid. Ask for a new one.").max(200),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80),
  email: z.string().trim().email("Enter a valid email.").max(120),
  password: z.string().min(8, "Password must be at least 8 characters.").max(72),
  kind: z.enum(["person", "business"]),
  city: z.string().refine(isCityName, "Choose a city."),
  terms: z.string().refine((value) => value === "1", "Agree to the Terms and Privacy Policy to create an account."),
});

export const reviewSchema = z.object({
  listingId: z.string().min(1),
  rating: z.coerce.number().int().min(1, "Choose a rating.").max(5),
  body: z.string().trim().min(2, "Write a short review.").max(1000),
});

export const reportSchema = z.object({
  listingId: z.string().optional().default(""),
  targetUserId: z.string().optional().default(""),
  reason: z.string().refine(
    (value): value is (typeof REPORT_REASONS)[number] =>
      (REPORT_REASONS as readonly string[]).includes(value),
    "Choose a reason.",
  ),
  details: z.string().trim().max(1000).default(""),
});

const httpUrl = (value: string) => value === "" || /^https?:\/\//i.test(value);

export const storefrontSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Shop address must be at least 3 characters.")
    .max(40, "Shop address must be 40 characters or fewer.")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  bannerUrl: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .refine(httpUrl, "Banner URL must start with http:// or https://."),
  bio: z.string().trim().max(500, "About must be 500 characters or fewer.").default(""),
});

export function parseStorefrontForm(formData: FormData) {
  const parsed = storefrontSchema.safeParse({
    slug: field(formData, "slug"),
    bannerUrl: field(formData, "bannerUrl"),
    bio: field(formData, "bio"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const published = formData.getAll("published").map(String).includes("1");
  const servesDiaspora = formData.getAll("servesDiaspora").map(String).includes("1");
  const occasionsPresent = formData.getAll("occasionsPresent").map(String).includes("1");
  const occasionSlugs = formData.getAll("occasion").flatMap((value) => (typeof value === "string" ? [value] : []));
  const rawCity = field(formData, "city").trim();
  const city = rawCity ? canonicalCity(rawCity) : "";
  if (rawCity && !city) return { ok: false as const, error: "Choose a town." };
  return { ok: true as const, data: { ...parsed.data, published, servesDiaspora, occasionsPresent, occasionSlugs, city } };
}

export function parsePriceCents(raw: string) {
  const parsed = parsePrice(raw);
  if (!parsed.ok) return { ok: false as const, error: parsed.error };
  return { ok: true as const, cents: parsed.minCents, maxCents: parsed.maxCents };
}

export const offeringSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(80),
  description: z.string().trim().min(2, "Add a short description.").max(400, "Keep the description under 400 characters."),
  currency: z.string().refine(isOfferingCurrency, "Choose KES or GBP."),
  imageUrl: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .refine(httpUrl, "Photo URL must start with http:// or https://."),
});

export function parseOfferingForm(formData: FormData) {
  const parsed = offeringSchema.safeParse({
    title: field(formData, "title"),
    description: field(formData, "description"),
    currency: field(formData, "currency"),
    imageUrl: field(formData, "imageUrl"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const price = parsePriceCents(field(formData, "price"));
  if (!price.ok) return price;
  return { ok: true as const, data: { ...parsed.data, priceCents: price.cents, priceMaxCents: price.maxCents } };
}

export { CATEGORIES, CITIES };

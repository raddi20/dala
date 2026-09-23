export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageType = (typeof TYPES)[number];

function isAllowedImageType(value: string): value is AllowedImageType {
  return (TYPES as readonly string[]).includes(value);
}

export function normalizeImageType(type: string): AllowedImageType | null {
  const value = type.toLowerCase().split(";")[0]?.trim() ?? "";
  if (value === "image/jpg" || value === "image/pjpeg") return "image/jpeg";
  if (isAllowedImageType(value)) return value;
  return null;
}

export function imageTypeFromName(name: string): AllowedImageType | null {
  const lower = name.toLowerCase().split("?")[0] ?? "";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

export function extensionForImageType(type: AllowedImageType): "jpg" | "png" | "webp" {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function clientImageChoiceError(file: { type: string; size: number; name: string }): string | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/heic" || type === "image/heif" || name.endsWith(".heic") || name.endsWith(".heif")) {
    return "This photo is HEIC. Choose a JPEG, PNG, or WebP, or take a new photo.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return "That file is empty.";
  if (file.size > MAX_SOURCE_BYTES) return "That photo is too large. Choose one under 20 MB.";
  if (!(normalizeImageType(file.type) ?? imageTypeFromName(file.name))) {
    return "Use a JPEG, PNG, or WebP photo.";
  }
  return null;
}

export function validateImagePayload(input: {
  type: string;
  size: number;
  name?: string;
  bytes: Uint8Array;
}): { ok: true; contentType: AllowedImageType } | { ok: false; error: string } {
  if (!Number.isFinite(input.size) || input.size <= 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (input.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "Photo must be 5 MB or smaller." };
  }
  const sniffed = sniffImageType(input.bytes);
  if (!sniffed) return { ok: false, error: "Use a JPEG, PNG, or WebP photo." };
  const claimed = normalizeImageType(input.type) ?? (input.name ? imageTypeFromName(input.name) : null);
  if (claimed && claimed !== sniffed) {
    return { ok: false, error: "That file does not match its photo type." };
  }
  return { ok: true, contentType: sniffed };
}

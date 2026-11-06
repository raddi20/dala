import sharp from "sharp";

const NAVY = "#1a2436";
const CREAM = "#fbf1dc";
const GOLD = "#c8881a";

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["Shop"];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1] ?? "";
  kept[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
  return kept;
}

function gateMark(x: number, y: number, scale: number) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none">
    <rect width="32" height="32" rx="8" fill="${NAVY}" />
    <path d="M9.5 26V13.2" stroke="${CREAM}" stroke-width="2" stroke-linecap="round" />
    <path d="M22.5 26V13.2" stroke="${CREAM}" stroke-width="2" stroke-linecap="round" />
    <path d="M9.5 13.4c0-4.6 13-4.6 13 0" stroke="${CREAM}" stroke-width="2" stroke-linecap="round" />
    <path d="M9.5 16.4h13" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round" />
  </g>`;
}

export type ShareCardInput = {
  name: string;
  url: string;
  subtitle?: string;
  /** data: or https URL already inlined as data URI; empty skips the photo panel. */
  photoDataUri?: string;
};

/** Square branded share card (1080×1080) with Rangach mark, name, and live URL. */
export function shareCardSvg(input: ShareCardInput): string {
  const width = 1080;
  const height = 1080;
  const nameLines = wrap(input.name, 18, 3);
  const nameSvg = nameLines
    .map(
      (line, index) =>
        `<text x="540" y="${640 + index * 56}" text-anchor="middle" font-family="Georgia, serif" font-size="48" font-weight="600" fill="${NAVY}">${xml(line)}</text>`,
    )
    .join("");
  const subtitle = (input.subtitle ?? "").trim();
  const photo = (input.photoDataUri ?? "").trim();
  const photoBlock = photo
    ? `<image href="${xml(photo)}" x="90" y="200" width="900" height="360" preserveAspectRatio="xMidYMid slice" />`
    : `<rect x="90" y="200" width="900" height="360" rx="24" fill="#e8dcc4" />
       <text x="540" y="400" text-anchor="middle" font-family="Georgia, serif" font-size="36" fill="${NAVY}">Rangach shop</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${CREAM}" />
  <rect width="${width}" height="160" fill="${NAVY}" />
  <rect y="160" width="${width}" height="14" fill="${GOLD}" />
  ${gateMark(80, 48, 2.2)}
  <text x="180" y="110" font-family="Georgia, serif" font-size="52" font-weight="600" fill="${CREAM}">Rangach</text>
  ${photoBlock}
  ${nameSvg}
  ${subtitle ? `<text x="540" y="${640 + nameLines.length * 56 + 8}" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#5c4a2e">${xml(subtitle)}</text>` : ""}
  <text x="540" y="980" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="${GOLD}">${xml(input.url.replace(/^https?:\/\//, ""))}</text>
  <text x="540" y="1035" text-anchor="middle" font-family="Georgia, serif" font-size="22" fill="#5c4a2e">Find us on Rangach</text>
</svg>`;
}

async function inlinePhoto(url: string): Promise<string> {
  const source = url.trim();
  if (!source) return "";
  if (source.startsWith("data:image/")) return source;
  try {
    const response = await fetch(source, {
      headers: { Accept: "image/*", "User-Agent": "RangachShareCard/1.0" },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    if (!response.ok) return "";
    const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!type.startsWith("image/")) return "";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < 32 || bytes.byteLength > 4_500_000) return "";
    const jpeg = await sharp(bytes, { failOn: "none" })
      .rotate()
      .resize(900, 360, { fit: "cover" })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return "";
  }
}

export async function shareCardPng(input: {
  name: string;
  url: string;
  subtitle?: string;
  photoUrl?: string;
}): Promise<Buffer> {
  const photoDataUri = input.photoUrl ? await inlinePhoto(input.photoUrl) : "";
  const svg = shareCardSvg({
    name: input.name,
    url: input.url,
    subtitle: input.subtitle,
    photoDataUri,
  });
  return sharp(Buffer.from(svg), { density: 180 }).png().toBuffer();
}

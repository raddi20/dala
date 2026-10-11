import sharp from "sharp";
import { qrDrawing } from "@/lib/sticker-qr";
import { STICKER_HOST, STICKER_KICKER, STICKER_SCAN, type StickerSize } from "@/lib/sticker";

const NAVY = "#1a2436";
const CREAM = "#fbf1dc";
const GOLD = "#c8881a";
const CLAY = "#a36d10";

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapName(name: string, maxChars: number, maxLines: number) {
  const words = name.trim().split(/\s+/).filter(Boolean);
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
  const cream = CREAM;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none">
    <rect width="32" height="32" rx="8" fill="${NAVY}" />
    <path d="M9.5 26V13.2" stroke="${cream}" stroke-width="2" stroke-linecap="round" />
    <path d="M22.5 26V13.2" stroke="${cream}" stroke-width="2" stroke-linecap="round" />
    <path d="M9.5 13.4c0-4.6 13-4.6 13 0" stroke="${cream}" stroke-width="2" stroke-linecap="round" />
    <path d="M9.5 16.4h13" stroke="${GOLD}" stroke-width="1.8" stroke-linecap="round" />
  </g>`;
}

export function stickerDocument(input: { name: string; url: string; size: StickerSize }) {
  const qr = qrDrawing(input.url);
  const square = input.size === "square";
  const width = square ? 1000 : 1050;
  const height = square ? 1000 : 1480;
  const lines = wrapName(input.name, square ? 18 : 16, square ? 2 : 3);
  const nameSize = square ? 44 : 64;
  const nameStart = square ? 300 : 390;
  const nameSvg = lines
    .map(
      (line, index) =>
        `<text x="${width / 2}" y="${nameStart + index * (nameSize + 8)}" text-anchor="middle" font-family="Noto Serif, Georgia, serif" font-size="${nameSize}" font-weight="600" fill="${NAVY}">${xml(line)}</text>`,
    )
    .join("");
  const qrSize = square ? 400 : 600;
  const qrY = square ? 410 : 620;
  const qrX = (width - qrSize) / 2;
  const scanY = square ? 860 : 1295;
  const hostY = square ? 950 : 1400;
  const mm = square ? "100mm" : "105mm";
  const mmHeight = square ? "100mm" : "148mm";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${mm}" height="${mmHeight}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${CREAM}" />
  <rect width="${width}" height="${square ? 180 : 240}" fill="${NAVY}" />
  <rect y="${square ? 180 : 240}" width="${width}" height="16" fill="${GOLD}" />
  ${gateMark(square ? 300 : 310, square ? 58 : 78, square ? 2.1 : 2.6)}
  <text x="${square ? 390 : 410}" y="${square ? 118 : 150}" font-family="Noto Serif, Georgia, serif" font-size="${square ? 48 : 64}" font-weight="600" fill="${CREAM}">Rangach</text>
  <text x="${width / 2}" y="${square ? 224 : 300}" text-anchor="middle" font-family="Noto Serif, Georgia, serif" font-size="${square ? 28 : 36}" font-weight="600" fill="${CLAY}">${xml(STICKER_KICKER)}</text>
  ${nameSvg}
  <svg x="${qrX}" y="${qrY}" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${qr.size} ${qr.size}" shape-rendering="crispEdges">
    <rect width="${qr.size}" height="${qr.size}" fill="#ffffff" />
    <path d="${qr.path}" fill="#000000" />
  </svg>
  <text x="${width / 2}" y="${scanY}" text-anchor="middle" font-family="Noto Sans, sans-serif" font-size="${square ? 28 : 34}" font-weight="700" fill="${NAVY}">${xml(STICKER_SCAN)}</text>
  <text x="${width / 2}" y="${hostY}" text-anchor="middle" font-family="Noto Serif, Georgia, serif" font-size="${square ? 32 : 40}" font-weight="700" fill="${NAVY}">${STICKER_HOST}</text>
</svg>`;
}

export async function stickerPng(input: { name: string; url: string; size: StickerSize }, density = 300) {
  const svg = stickerDocument(input);
  return sharp(Buffer.from(svg), { density }).png().toBuffer();
}

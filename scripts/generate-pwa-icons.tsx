/**
 * Rasterise the gate mark into the PWA icons committed under public/icons.
 * Run with: node --import tsx scripts/generate-pwa-icons.tsx
 * The mark matches src/components/wordmark.tsx and src/app/apple-icon.tsx.
 * Maskable icons keep the painted mark inside the centre safe zone (circle radius 40%).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

const NAVY = "#1a2436";
const CREAM = "#fbf1dc";
const AMBER = "#c8881a";

function Gate({ mark }: { mark: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: NAVY,
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 32 32" fill="none">
        <path d="M9.5 26V13.2" stroke={CREAM} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M22.5 26V13.2" stroke={CREAM} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M9.5 13.4c0-4.6 13-4.6 13 0" stroke={CREAM} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M9.5 16.4h13" stroke={AMBER} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

async function writeIcon(name: string, size: number, markRatio: number) {
  const mark = Math.round(size * markRatio);
  const response = new ImageResponse(<Gate mark={mark} />, { width: size, height: size });
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(`../public/icons/${name}`, import.meta.url), bytes);
}

async function main() {
  await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });
  // "any" matches the apple-touch icon scale (about two thirds of the canvas).
  await writeIcon("icon-192.png", 192, 0.68);
  await writeIcon("icon-512.png", 512, 0.68);
  // Maskable: full-bleed navy, mark smaller so it stays inside the 80% safe circle.
  await writeIcon("icon-maskable-192.png", 192, 0.5);
  await writeIcon("icon-maskable-512.png", 512, 0.5);
  console.log("Wrote public/icons/icon-192.png, icon-512.png, icon-maskable-192.png, icon-maskable-512.png");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

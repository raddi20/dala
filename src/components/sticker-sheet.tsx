import { Wordmark } from "@/components/wordmark";
import { qrDrawing } from "@/lib/sticker-qr";
import { STICKER_HOST, STICKER_KICKER, STICKER_SCAN, type StickerSize } from "@/lib/sticker";

export function StickerQr({ url, className }: { url: string; className?: string }) {
  const qr = qrDrawing(url);
  return (
    <svg
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      className={className}
      role="img"
      aria-label={`QR code for ${url}`}
      shapeRendering="crispEdges"
    >
      <rect width={qr.size} height={qr.size} fill="#ffffff" />
      <path d={qr.path} fill="#000000" />
    </svg>
  );
}

export function StickerSheet({ name, url, size }: { name: string; url: string; size: StickerSize }) {
  return (
    <article className={size === "square" ? "sticker sticker-square" : "sticker sticker-a6"}>
      <div className="sticker-brand">
        <Wordmark tone="onDark" />
      </div>
      <div className="sticker-body">
        <p className="sticker-kicker">{STICKER_KICKER}</p>
        <h1 className="sticker-name">{name}</h1>
        <StickerQr url={url} className="sticker-qr" />
        <p className="sticker-scan">{STICKER_SCAN}</p>
        <p className="sticker-host">{STICKER_HOST}</p>
      </div>
    </article>
  );
}

import { publicOrigin } from "@/lib/payments/origin";
import { stickerDocument, stickerPng } from "@/lib/sticker-svg";
import { loadStickerShop } from "@/lib/sticker-shop";
import { parseStickerSize, stickerFilename, stickerTargetUrl } from "@/lib/sticker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const shop = await loadStickerShop(slug);
  if (!shop) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const size = parseStickerSize(url.searchParams.get("size"));
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";
  const download = url.searchParams.get("download") === "1";
  const target = stickerTargetUrl(await publicOrigin(), shop.slug);
  const filename = stickerFilename(shop.slug, size, format);
  const disposition = `${download ? "attachment" : "inline"}; filename="${filename}"`;
  const shared = {
    "Content-Disposition": disposition,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (format === "png") {
    const png = await stickerPng({ name: shop.name, url: target, size });
    return new Response(new Uint8Array(png), {
      headers: { ...shared, "Content-Type": "image/png", "Content-Length": String(png.byteLength) },
    });
  }

  const svg = stickerDocument({ name: shop.name, url: target, size });
  return new Response(svg, {
    headers: { ...shared, "Content-Type": "image/svg+xml; charset=utf-8" },
  });
}

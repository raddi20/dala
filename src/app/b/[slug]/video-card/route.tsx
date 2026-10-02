import { loadShopOg } from "@/lib/og-load";
import { renderOgCard } from "@/lib/og-card";
import { jpegUnderLimit } from "@/lib/video/og-jpeg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const model = await loadShopOg(slug);
  if (!model.showPlay) return new Response("No public shop video.", { status: 404 });
  const image = await renderOgCard(model);
  const png = Buffer.from(await image.arrayBuffer());
  const jpeg = await jpegUnderLimit(png);
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=300",
      "Content-Length": String(jpeg.byteLength),
    },
  });
}

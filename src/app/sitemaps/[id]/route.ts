import { NextResponse } from "next/server";
import { chunkSitemap } from "@/lib/crawl-index";
import { collectSitemapEntries } from "@/lib/sitemap-data";
import { renderSitemapUrlset } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const entries = await collectSitemapEntries();
  const chunks = chunkSitemap(entries);
  const index = Number(id);
  // A single sitemap is served at /sitemap.xml. Pieces exist only once it splits.
  if (chunks.length <= 1 || index >= chunks.length) return new NextResponse("Not found", { status: 404 });
  const xml = renderSitemapUrlset(chunks[index] ?? []);
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

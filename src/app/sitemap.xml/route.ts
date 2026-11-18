import { NextResponse } from "next/server";
import { chunkLastModified, chunkSitemap } from "@/lib/crawl-index";
import { publicOrigin } from "@/lib/payments/origin";
import { collectSitemapEntries } from "@/lib/sitemap-data";
import { renderSitemapIndex, renderSitemapUrlset } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";

function xmlResponse(xml: string) {
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export async function GET() {
  const entries = await collectSitemapEntries();
  const chunks = chunkSitemap(entries);
  if (chunks.length <= 1) return xmlResponse(renderSitemapUrlset(chunks[0] ?? []));
  const origin = await publicOrigin();
  return xmlResponse(
    renderSitemapIndex(
      chunks.map((chunk, index) => ({
        loc: `${origin}/sitemaps/${index}.xml`,
        lastModified: chunkLastModified(chunk),
      })),
    ),
  );
}

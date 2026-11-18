import type { MetadataRoute } from "next";

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lastMod(value: Date | string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `<lastmod>${date.toISOString()}</lastmod>`;
}

/** One urlset. Used for the whole catalogue, and for each piece once it is split. */
export function renderSitemapUrlset(entries: MetadataRoute.Sitemap) {
  const urls = entries
    .map((entry) => {
      const freq = entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : "";
      const priority = entry.priority !== undefined ? `<priority>${entry.priority}</priority>` : "";
      return `<url><loc>${xmlEscape(entry.url)}</loc>${lastMod(entry.lastModified)}${freq}${priority}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

export function renderSitemapIndex(entries: { loc: string; lastModified?: Date }[]) {
  const body = entries
    .map((entry) => `<sitemap><loc>${xmlEscape(entry.loc)}</loc>${lastMod(entry.lastModified)}</sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</sitemapindex>\n`;
}

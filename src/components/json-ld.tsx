import { jsonLdString } from "@/lib/seo";

/** Renders schema.org JSON-LD. Pass plain objects from @/lib/seo only. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}

import type { MetadataRoute } from "next";
import { publicOrigin } from "@/lib/payments/origin";
import { buildRobots } from "@/lib/sitemap-entries";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return buildRobots(await publicOrigin());
}

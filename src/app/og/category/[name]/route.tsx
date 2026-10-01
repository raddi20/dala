import { loadCategoryOg } from "@/lib/og-load";
import { renderOgCard } from "@/lib/og-card";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const model = loadCategoryOg(name);
  if (!model) return new Response("Not found", { status: 404 });
  return renderOgCard(model);
}

import { interpretSearch } from "@/lib/ai/search-parse";
import { searchCatalogue } from "@/lib/search";
import { sulweAsk } from "@/lib/sulwe";

export const dynamic = "force-dynamic";

/** Same sentence search as Ask Rangach. The model, when it runs, stays inside the existing cap. */
export async function POST(request: Request) {
  let body: { q?: unknown } = {};
  try {
    body = (await request.json()) as { q?: unknown };
  } catch {
    body = {};
  }
  const query = typeof body.q === "string" ? body.q : "";
  const result = await sulweAsk(query, {
    interpret: (input) => interpretSearch(input),
    search: (filters) => searchCatalogue(filters),
  });
  return Response.json(result);
}

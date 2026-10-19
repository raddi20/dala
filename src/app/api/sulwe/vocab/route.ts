import { voiceVocabulary } from "@/lib/voice-vocab";

export const dynamic = "force-dynamic";

/**
 * Catalogue words for Sulwe's voice correction: public listing and offering title words only,
 * with seller names removed. Cached for ten minutes. Never fails the chat: errors return an empty list.
 */
export async function GET() {
  let words: string[] = [];
  try {
    words = await voiceVocabulary();
  } catch {
    words = [];
  }
  return Response.json(
    { words },
    { headers: { "Cache-Control": "public, max-age=600, s-maxage=600, stale-while-revalidate=600" } },
  );
}

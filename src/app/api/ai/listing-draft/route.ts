import { NextResponse } from "next/server";
import { isAiFeatureOn } from "@/lib/ai/flags";
import { createListingDraft, loadListingDraftStore } from "@/lib/ai/listing-draft";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ enabled: false, consented: false });
  const enabled = await isAiFeatureOn("listing_writer");
  if (!enabled) return NextResponse.json({ enabled: false, consented: false });
  try {
    const prefs = await prisma.sellerAiPrefs.findUnique({
      where: { userId: user.id },
      select: { aiConsentAt: true },
    });
    return NextResponse.json({ enabled: true, consented: Boolean(prefs?.aiConsentAt) });
  } catch {
    return NextResponse.json({ enabled: true, consented: false });
  }
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Describe the listing in 200 characters or fewer." }, { status: 400 });
  }
  try {
    const user = await getSessionUser();
    const store = await loadListingDraftStore(user);
    const result = await createListingDraft(raw, { store });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.suggestion);
  } catch {
    return NextResponse.json(
      { error: "Not available right now. You can still fill the form yourself." },
      { status: 503 },
    );
  }
}

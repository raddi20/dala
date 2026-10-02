import { NextResponse } from "next/server";
import { actorFromRequestCookie, draftFamilyOrder } from "@/lib/ai/family-draft";
import { isAiFeatureOn } from "@/lib/ai/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const blank = { item: "", recipientName: "", town: "", dateNeeded: "", payer: "", notes: "" };

export async function GET() {
  const enabled = await isAiFeatureOn("family_helper");
  return NextResponse.json({ enabled });
}

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(blank);
  }
  try {
    const actorHash = actorFromRequestCookie(request.headers.get("cookie"));
    const result = await draftFamilyOrder(raw, { actorHash });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result.fields);
  } catch {
    return NextResponse.json(
      { error: "Not available right now. You can still fill the form yourself." },
      { status: 503 },
    );
  }
}

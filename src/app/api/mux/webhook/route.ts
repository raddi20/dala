import { NextResponse } from "next/server";
import { getVideoBackend } from "@/lib/video/backend";
import { videoMode } from "@/lib/video/config";
import { verifyMuxSignature } from "@/lib/video/signature";
import { handleMuxEvent, purgeExpiredVideos } from "@/lib/video/service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const mode = videoMode();
  if (mode === "off") {
    return NextResponse.json({ error: "Shop video is not configured." }, { status: 503 });
  }
  const raw = await request.text();
  const secret = process.env.MUX_WEBHOOK_SECRET;
  const verified = verifyMuxSignature(raw, request.headers.get("mux-signature"), secret);
  if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 401 });

  let payload: { id?: unknown; type?: unknown; data?: unknown };
  try {
    payload = JSON.parse(raw) as { id?: unknown; type?: unknown; data?: unknown };
  } catch {
    return NextResponse.json({ error: "Webhook body is not JSON." }, { status: 400 });
  }
  const eventId = typeof payload.id === "string" ? payload.id : "";
  const type = typeof payload.type === "string" ? payload.type : "";
  if (!eventId || !type) return NextResponse.json({ error: "Webhook event is missing an id or type." }, { status: 400 });

  const backend = await getVideoBackend();
  if (!backend) return NextResponse.json({ error: "Shop video is not configured." }, { status: 503 });

  try {
    const result = await handleMuxEvent(prisma, backend, { eventId, type, data: payload.data });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    await purgeExpiredVideos(prisma, backend);
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (error) {
    console.error("Mux webhook failed", error);
    return NextResponse.json({ error: "Could not record the webhook." }, { status: 500 });
  }
}

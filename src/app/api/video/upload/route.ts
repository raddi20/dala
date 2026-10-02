import { NextResponse } from "next/server";
import { z } from "zod";
import { getVideoBackend } from "@/lib/video/backend";
import { isAllowedUploadOrigin, videoMode } from "@/lib/video/config";
import { createShopVideoUpload } from "@/lib/video/service";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  consent: z.boolean(),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().max(120).optional().default(""),
  sizeBytes: z.number(),
  durationSeconds: z.number().nullable(),
  caption: z.string().max(200).optional().default(""),
});

export async function POST(request: Request) {
  if (videoMode() === "off") {
    return NextResponse.json({ error: "Shop video is coming soon." }, { status: 503 });
  }
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload a video." }, { status: 401 });
  const shop = await prisma.storefront.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!shop) return NextResponse.json({ error: "Start your shop first." }, { status: 400 });

  const origin = request.headers.get("origin") ?? "";
  if (!isAllowedUploadOrigin(origin)) {
    return NextResponse.json({ error: "Upload from the Rangach site." }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "The upload form was not readable." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Check the file and the consent box." }, { status: 400 });

  const backend = await getVideoBackend();
  if (!backend) return NextResponse.json({ error: "Shop video is coming soon." }, { status: 503 });

  const result = await createShopVideoUpload(prisma, backend, {
    actor: { id: user.id, role: user.role, verifiedPro: user.verifiedPro },
    storefrontId: shop.id,
    corsOrigin: origin,
    consent: parsed.data.consent,
    fileName: parsed.data.fileName,
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
    durationSeconds: parsed.data.durationSeconds,
    caption: parsed.data.caption,
  });
  if (!result.ok) {
    const status = result.code === "pro" || result.code === "forbidden" ? 403 : result.code === "rate" || result.code === "inflight" ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({
    videoId: result.videoId,
    uploadUrl: result.uploadUrl,
    chunkSizeKb: result.chunkSizeKb,
  });
}

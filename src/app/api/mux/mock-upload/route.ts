import { NextResponse } from "next/server";
import { getVideoBackend } from "@/lib/video/backend";
import { videoMode } from "@/lib/video/config";
import { completeMockUpload } from "@/lib/video/service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isLastChunk(header: string | null) {
  if (!header) return true;
  const match = /bytes\s+(\d+)-(\d+)\/(\d+)/i.exec(header);
  if (!match) return true;
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isFinite(end) || !Number.isFinite(total) || total <= 0) return true;
  return end + 1 >= total;
}

async function receive(request: Request) {
  if (videoMode() !== "mock") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const uploadId = new URL(request.url).searchParams.get("upload")?.trim() ?? "";
  if (!uploadId) return NextResponse.json({ error: "Missing upload." }, { status: 400 });
  await request.arrayBuffer();
  const delay = Number(process.env.MUX_MOCK_DELAY_MS ?? "700");
  if (Number.isFinite(delay) && delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  if (!isLastChunk(request.headers.get("content-range"))) {
    return new NextResponse(null, { status: 200 });
  }
  const backend = await getVideoBackend();
  if (!backend) return NextResponse.json({ error: "Mock video is off." }, { status: 503 });
  const result = await completeMockUpload(prisma, backend, uploadId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
  return new NextResponse(null, { status: 200 });
}

export function PUT(request: Request) {
  return receive(request);
}

export function POST(request: Request) {
  return receive(request);
}

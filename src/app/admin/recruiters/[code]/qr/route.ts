import { NextResponse } from "next/server";
import { recruiterQrPixels, recruiterQrPng } from "@/lib/recruiter-qr";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { normalizeRecruiterCode, recruiterShortUrl } from "@/lib/recruiter";
import { requireAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  await requireAdmin("/admin/recruiters");
  const { code: raw } = await context.params;
  const code = normalizeRecruiterCode(decodeURIComponent(raw));
  if (!code) return new NextResponse("Not found", { status: 404 });
  const recruiter = await prisma.recruiter.findUnique({ where: { code }, select: { code: true } });
  if (!recruiter) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const link = recruiterShortUrl(await publicOrigin(), recruiter.code);
  const png = await recruiterQrPng(link, recruiterQrPixels(url.searchParams.get("px")));
  const download = url.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="rangach-recruiter-${recruiter.code}.png"`,
    },
  });
}

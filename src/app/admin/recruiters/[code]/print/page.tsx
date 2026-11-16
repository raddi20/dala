import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { btnSecondary } from "@/components/ui";
import { RECRUITER_QR_PRINT_PX } from "@/lib/recruiter-qr";
import { prisma } from "@/lib/prisma";
import { publicOrigin } from "@/lib/payments/origin";
import { normalizeRecruiterCode, recruiterShortUrl, recruiterSignupUrl } from "@/lib/recruiter";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "Recruiter QR",
  robots: { index: false, follow: false },
};

export default async function RecruiterPrintPage({ params }: { params: Promise<{ code: string }> }) {
  await requireAdmin("/admin/recruiters");
  const { code: raw } = await params;
  const code = normalizeRecruiterCode(decodeURIComponent(raw));
  if (!code) notFound();
  const recruiter = await prisma.recruiter.findUnique({ where: { code } });
  if (!recruiter) notFound();
  const origin = await publicOrigin();
  const link = recruiterShortUrl(origin, recruiter.code);
  const longLink = recruiterSignupUrl(origin, recruiter.code);
  const png = `/admin/recruiters/${recruiter.code}/qr?px=${RECRUITER_QR_PRINT_PX}`;

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton label="Print this QR" />
        <a href={`${png}&download=1`} className={btnSecondary}>
          Download large PNG
        </a>
        <Link href="/admin/recruiters" className={btnSecondary}>
          All recruiters
        </Link>
      </div>
      <article className="grid justify-items-center gap-4 rounded-[14px] border border-line bg-card p-6 text-center print:border-0 print:shadow-none">
        <h1 className="font-serif text-3xl text-navy">{recruiter.name}</h1>
        <p className="text-sm text-ink/70">Scan to list your shop.</p>
        {/* The file is 1536px on a side. The page scales it down on a phone and prints it large. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={png} alt={`QR code for ${link}`} width={RECRUITER_QR_PRINT_PX} height={RECRUITER_QR_PRINT_PX} className="h-auto w-full max-w-[40rem] bg-white" />
        <p className="break-all text-sm font-semibold text-navy">{link}</p>
        <p className="break-all text-xs text-ink/60">{longLink}</p>
        {recruiter.active ? null : <p className="text-sm text-ink/60">This recruiter is inactive. New shops are not counted on this code.</p>}
      </article>
    </div>
  );
}

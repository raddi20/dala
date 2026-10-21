import { isDemoEmail } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** A public listing whose WhatsApp button is actually shown. Demo numbers stay hidden, so those rows are skipped. */
export async function GET() {
  const rows = await prisma.listing.findMany({
    where: {
      hidden: false,
      contactWhatsapp: { not: "" },
      owner: { suspended: false },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      contactWhatsapp: true,
      owner: { select: { email: true } },
    },
  });
  const pick = rows.find((row) => row.contactWhatsapp.trim() && !isDemoEmail(row.owner.email));
  return Response.json(
    { path: pick ? `/listings/${pick.id}` : null },
    // Same answer for every visitor; let the CDN absorb repeat tours.
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}

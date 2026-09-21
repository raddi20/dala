import { typeLabel } from "@/lib/constants";
import { isFeatured } from "@/lib/utils";

export function Badges({
  type,
  verified,
  verifiedPro,
  featured,
  featuredUntil,
  scamRisk,
}: {
  type: string;
  verified: boolean;
  verifiedPro?: boolean;
  featured: boolean;
  featuredUntil: Date | null;
  scamRisk?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-medium">{typeLabel(type)}</span>
      {verified ? (
        <span className="rounded-full bg-lake px-2 py-0.5 text-xs font-semibold text-white">Verified</span>
      ) : null}
      {verifiedPro ? (
        <span className="rounded-full bg-clay px-2 py-0.5 text-xs font-semibold text-white">Verified Pro</span>
      ) : null}
      {isFeatured({ featured, featuredUntil }) ? (
        <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-paper">Featured</span>
      ) : null}
      {scamRisk === "high" ? (
        <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white">Scam risk</span>
      ) : null}
      {scamRisk === "medium" ? (
        <span className="rounded-full bg-warn px-2 py-0.5 text-xs font-semibold text-white">Check details</span>
      ) : null}
    </div>
  );
}

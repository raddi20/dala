import { typeLabel } from "@/lib/constants";
import { isFeatured } from "@/lib/utils";

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "verified" | "pro" | "featured" | "danger" | "warn" | "city";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-paper text-ink/75 ring-sand",
    verified: "bg-teal-soft text-lake-dark ring-lake/20",
    pro: "bg-amber-soft text-clay-dark ring-clay/25",
    featured: "bg-navy text-white ring-navy",
    danger: "bg-red-50 text-danger ring-danger/20",
    warn: "bg-amber-soft text-warn ring-warn/25",
    city: "bg-white/90 text-navy ring-white/60 backdrop-blur",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}>
      {children}
    </span>
  );
}

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
      <Chip>{typeLabel(type)}</Chip>
      {verified ? <Chip tone="verified">Verified</Chip> : null}
      {verifiedPro ? <Chip tone="pro">Verified Pro</Chip> : null}
      {isFeatured({ featured, featuredUntil }) ? <Chip tone="featured">Featured</Chip> : null}
      {scamRisk === "high" ? <Chip tone="danger">Scam risk</Chip> : null}
      {scamRisk === "medium" ? <Chip tone="warn">Check details</Chip> : null}
    </div>
  );
}

export function CityBadge({ city }: { city: string }) {
  return <Chip tone="city">{city}</Chip>;
}

import { typeLabel } from "@/lib/constants";
import { DIASPORA_ORDERS_EXPLANATION, DIASPORA_ORDERS_LABEL } from "@/lib/diaspora";
import {
  PRO_PLAN_EXPLANATION,
  PRO_PLAN_LABEL,
  SHOP_BADGES,
  grantedShopBadges,
  latestShopBadgeGrant,
  shopBadgeCheckedLine,
  type ShopBadgeFlags,
  type ShopBadgeGrantRecord,
} from "@/lib/shop-badges";
import { isFeatured } from "@/lib/utils";

function Chip({
  children,
  tone = "neutral",
  title,
  label,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "verified" | "pro" | "featured" | "danger" | "warn" | "city" | "diaspora";
  title?: string;
  label?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-paper text-ink/75 ring-sand",
    verified: "bg-teal-soft text-lake-dark ring-lake/20",
    pro: "bg-amber-soft text-clay-dark ring-clay/25",
    featured: "bg-navy text-white ring-navy",
    danger: "bg-red-50 text-danger ring-danger/20",
    warn: "bg-amber-soft text-warn ring-warn/25",
    city: "bg-white/90 text-navy ring-white/60 backdrop-blur",
    diaspora: "bg-white text-navy ring-lake/40",
  };
  return (
    <span
      title={title}
      aria-label={label}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function DiasporaOrdersTag() {
  return (
    <Chip tone="diaspora" title={DIASPORA_ORDERS_EXPLANATION} label={`${DIASPORA_ORDERS_LABEL}. ${DIASPORA_ORDERS_EXPLANATION}`}>
      {DIASPORA_ORDERS_LABEL}
    </Chip>
  );
}

export function ProPlanChip() {
  return (
    <Chip tone="pro" title={PRO_PLAN_EXPLANATION} label={`${PRO_PLAN_LABEL}. ${PRO_PLAN_EXPLANATION}`}>
      {PRO_PLAN_LABEL}
    </Chip>
  );
}

function checkLine(badgeKey: string, events?: ShopBadgeGrantRecord[]) {
  const grant = latestShopBadgeGrant(events ?? [], badgeKey);
  if (!grant) return "";
  return shopBadgeCheckedLine({ badge: badgeKey, createdAt: grant.createdAt, method: grant.method });
}

export function ShopBadgeChips({
  flags,
  events,
}: {
  flags?: ShopBadgeFlags | null;
  events?: ShopBadgeGrantRecord[];
}) {
  const granted = grantedShopBadges(flags);
  if (granted.length === 0) return null;
  return (
    <>
      {granted.map((badge) => {
        const line = checkLine(badge.key, events);
        const detail = line ? `${line}. ${badge.explanation}` : badge.explanation;
        return (
          <Chip key={badge.key} tone="verified" title={detail} label={`${badge.label}. ${detail}`}>
            {badge.label}
          </Chip>
        );
      })}
    </>
  );
}

export function ShopBadgeNotes({
  flags,
  events,
}: {
  flags?: ShopBadgeFlags | null;
  events?: ShopBadgeGrantRecord[];
}) {
  const granted = grantedShopBadges(flags);
  if (granted.length === 0) return null;
  return (
    <ul className="mt-3 grid gap-1 text-sm text-ink/65">
      {granted.map((badge) => {
        const line = checkLine(badge.key, events);
        return (
          <li key={badge.key}>
            <span className="font-semibold text-ink/80">{line ? `${line}.` : `${badge.label}.`}</span> {badge.explanation}
          </li>
        );
      })}
    </ul>
  );
}

export function ShopBadgeStatus({
  flags,
  events,
}: {
  flags: ShopBadgeFlags;
  events?: ShopBadgeGrantRecord[];
}) {
  return (
    <div className="grid gap-3">
      <div>
        <h3 className="font-serif text-xl text-navy">Shop checks</h3>
        <p className="mt-1 text-sm text-ink/65">
          An admin grants these one at a time, and records how they checked. They are separate from the paid Pro plan.
          Documents seen means the admin looked at them. Nothing is uploaded or stored.
        </p>
      </div>
      <ul className="grid gap-2">
        {SHOP_BADGES.map((badge) => {
          const on = flags[badge.field];
          const line = on ? checkLine(badge.key, events) : "";
          return (
            <li key={badge.key} className="rounded-xl bg-paper px-3 py-2">
              <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">{badge.label}</span>
                <span className={on ? "font-semibold text-lake-dark" : "text-ink/55"}>{on ? "Granted" : "Not granted"}</span>
              </p>
              {line ? <p className="mt-1 text-sm font-medium text-ink/80">{line}.</p> : null}
              <p className="mt-1 text-sm text-ink/65">{badge.explanation}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const LISTING_VERIFIED = "An admin marked this directory listing as verified. Separate from shop checks.";

export function Badges({
  type,
  verified,
  verifiedPro,
  shopBadges,
  servesDiaspora,
  featured,
  featuredUntil,
  scamRisk,
}: {
  type: string;
  verified: boolean;
  verifiedPro?: boolean;
  shopBadges?: ShopBadgeFlags | null;
  servesDiaspora?: boolean;
  featured: boolean;
  featuredUntil: Date | null;
  scamRisk?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip>{typeLabel(type)}</Chip>
      {verified ? (
        <Chip tone="verified" title={LISTING_VERIFIED} label={`Verified. ${LISTING_VERIFIED}`}>
          Verified
        </Chip>
      ) : null}
      <ShopBadgeChips flags={shopBadges} />
      {servesDiaspora ? <DiasporaOrdersTag /> : null}
      {verifiedPro ? <ProPlanChip /> : null}
      {isFeatured({ featured, featuredUntil }) ? <Chip tone="featured">Featured</Chip> : null}
      {scamRisk === "high" ? <Chip tone="danger">Scam risk</Chip> : null}
      {scamRisk === "medium" ? <Chip tone="warn">Check details</Chip> : null}
    </div>
  );
}

export function CityBadge({ city }: { city: string }) {
  return <Chip tone="city">{city}</Chip>;
}

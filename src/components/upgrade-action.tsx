import Link from "next/link";
import { PAID_UPGRADES_COMING_SOON } from "@/lib/payments/live";

/** Pay, promote, and upgrade controls. While payments are off, the same spot says they are coming soon. */
export function UpgradeAction({
  live,
  href,
  label,
  className,
}: {
  live: boolean;
  href: string;
  label: string;
  className?: string;
}) {
  if (!live) {
    return <span className={className ? `${className} cursor-default` : "text-sm font-semibold text-navy"}>{PAID_UPGRADES_COMING_SOON}</span>;
  }
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

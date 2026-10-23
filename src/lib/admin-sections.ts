/** Admin sections: one tile on /admin and one tab in the admin nav for each. */
export type AdminCountKey = "openReports" | "pendingReviews" | "pendingShopChecks" | "pendingVideos" | "riskyListings";

export type AdminSection = {
  href: string;
  label: string;
  blurb: string;
  count?: AdminCountKey;
  /** Red badge: something is waiting on an admin. Amber: worth a look. */
  urgent?: boolean;
};

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { href: "/admin/reports", label: "Reports", blurb: "Reports from people about listings, shops and profiles.", count: "openReports", urgent: true },
  { href: "/admin/reviews", label: "Reviews", blurb: "Listing reviews and shop ratings waiting for approval.", count: "pendingReviews", urgent: true },
  { href: "/admin/shop-checks", label: "Shop checks", blurb: "Phone, location and business checks, takedowns and shop videos.", count: "pendingShopChecks", urgent: true },
  { href: "/admin/listings", label: "Listings", blurb: "Hide, verify or feature listings. Occasion curation.", count: "riskyListings" },
  { href: "/admin/people", label: "People", blurb: "Suspend accounts and grant the Pro plan." },
  { href: "/admin/field-agents", label: "Field agents", blurb: "Sign-ups per brochure code." },
  { href: "/admin/activity", label: "Activity", blurb: "Recent admin actions from the audit log." },
  { href: "/admin/mail", label: "Mail", blurb: "Test the password reset mail." },
  { href: "/admin/phones", label: "Phone numbers", blurb: "Clean up phone and WhatsApp numbers." },
  { href: "/admin/business", label: "Business sign-ups", blurb: "Business leads and export." },
  { href: "/admin/orders", label: "Protected orders", blurb: "Orders paid through Paystack." },
  { href: "/admin/send-home", label: "Send-home waitlist", blurb: "Diaspora waitlist and export." },
  { href: "/admin/ai", label: "AI usage", blurb: "AI spend and AI flags." },
];

export type AdminCounts = Partial<Record<AdminCountKey, number>>;

export type AdminTile = AdminSection & { badge: number; tone: "red" | "amber" | "none" };

/** Tiles for the dashboard. Orders shows only while protected orders are on. */
export function adminTiles(counts: AdminCounts, options: { ordersOn: boolean }): AdminTile[] {
  return ADMIN_SECTIONS.filter((section) => options.ordersOn || section.href !== "/admin/orders").map((section) => {
    const badge = section.count ? (counts[section.count] ?? 0) : 0;
    const tone = badge === 0 ? "none" : section.urgent ? "red" : "amber";
    return { ...section, badge, tone };
  });
}

/** The nav tab to mark active. Deeper pages (e.g. /admin/ai/flags) light up their section. */
export function activeAdminHref(pathname: string): string {
  if (pathname === "/admin") return "/admin";
  const match = ADMIN_SECTIONS.filter((section) => pathname === section.href || pathname.startsWith(`${section.href}/`));
  return match.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? "";
}

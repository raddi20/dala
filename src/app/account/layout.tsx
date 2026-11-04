import type { Metadata } from "next";

/** Account pages are private. Robots.txt disallows /account too; this covers a page Google reaches by a link. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}

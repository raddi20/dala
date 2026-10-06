import Link from "next/link";
import type { ReactNode } from "react";
import { cardClass } from "@/components/ui";
import { CONTACT_EMAIL, PUBLIC_INFO_PAGES, PUBLIC_PAGES_UPDATED, type PublicInfoPath } from "@/lib/public-info";

export function InfoPage({
  path,
  kicker,
  title,
  lede,
  children,
}: {
  path: PublicInfoPath;
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto grid max-w-2xl gap-5 px-4 py-8 sm:py-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-lake">{kicker}</p>
        <h1 className="mt-2 font-serif text-3xl text-navy sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm font-medium text-ink/70">Last updated {PUBLIC_PAGES_UPDATED.label}</p>
        <p className="mt-3 text-sm leading-relaxed text-ink/75">{lede}</p>
      </header>
      {children}
      <InfoFooterNav current={path} />
    </article>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${cardClass} grid gap-3 p-5 text-sm leading-relaxed text-ink/85`}>
      <h2 className="font-serif text-xl text-navy">{title}</h2>
      {children}
    </section>
  );
}

export function InfoFooterNav({ current }: { current: PublicInfoPath }) {
  return (
    <nav aria-label="More about Rangach" className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold">
      {PUBLIC_INFO_PAGES.map((page) =>
        page.path === current ? (
          <span key={page.path} aria-current="page" className="text-ink/40">
            {page.label}
          </span>
        ) : (
          <Link key={page.path} href={page.path} className="text-lake-dark hover:text-lake">
            {page.label}
          </Link>
        ),
      )}
      <Link href="/pricing" className="text-lake-dark hover:text-lake">
        Pricing
      </Link>
      <Link href="/video-policy" className="text-lake-dark hover:text-lake">
        Video policy
      </Link>
      <a href={`mailto:${CONTACT_EMAIL}`} className="break-all text-lake-dark hover:text-lake">
        {CONTACT_EMAIL}
      </a>
    </nav>
  );
}

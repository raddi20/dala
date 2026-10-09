import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState, sectionTitleClass } from "@/components/ui";

export function HomeRail({
  title,
  hint,
  browseHref,
  browseLabel,
  emptyTitle,
  emptyBody,
  empty,
  action,
  children,
}: {
  title: string;
  hint: string;
  browseHref: string;
  browseLabel: string;
  emptyTitle: string;
  emptyBody: string;
  empty: boolean;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className={sectionTitleClass}>{title}</h2>
          <p className="mt-1 text-sm text-ink/60">{hint}</p>
        </div>
        <Link href={browseHref} className="shrink-0 text-sm font-semibold text-lake-dark hover:text-lake">
          {browseLabel}
        </Link>
      </div>
      {empty ? (
        <div className="mt-5">
          <EmptyState title={emptyTitle} body={emptyBody} action={action} />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

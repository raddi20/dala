import Link from "next/link";

const linkClass =
  "inline-flex min-h-11 items-center rounded-xl border border-sand bg-white px-4 text-sm font-semibold text-navy";

export function Pager({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={linkClass}>
          Previous
        </Link>
      ) : (
        <span className={`${linkClass} text-ink/30`}>Previous</span>
      )}
      <p className="text-sm text-ink/60">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={linkClass}>
          Next
        </Link>
      ) : (
        <span className={`${linkClass} text-ink/30`}>Next</span>
      )}
    </nav>
  );
}

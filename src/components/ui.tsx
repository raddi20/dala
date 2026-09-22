export const fieldClass =
  "mt-1 w-full rounded-xl border border-sand bg-white px-3.5 py-2.5 text-base text-ink shadow-sm placeholder:text-ink/40 transition-[border-color,box-shadow] duration-150 focus:border-lake focus:outline-none focus:ring-2 focus:ring-lake/20";

export const labelClass = "block text-sm font-medium text-ink/80";

export const btnPrimary =
  "btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-clay px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-clay-dark disabled:opacity-60";

export const btnSecondary =
  "btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-sand bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm hover:border-navy/20 hover:bg-paper disabled:opacity-60";

export const btnNavy =
  "btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-soft disabled:opacity-60";

export const btnDanger =
  "btn-press inline-flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-white px-4 py-2.5 text-sm font-semibold text-danger hover:bg-red-50 disabled:opacity-60";

export const btnWhatsApp =
  "btn-press inline-flex items-center justify-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0e7368] disabled:opacity-60";

export const cardClass =
  "rounded-[1.25rem] border border-sand/80 bg-card shadow-[var(--shadow-card)]";

export const chipClass =
  "inline-flex shrink-0 items-center rounded-full border border-sand bg-white px-3 py-1.5 text-sm font-medium text-ink/80 transition-colors duration-150 hover:border-navy/25 hover:bg-paper";

export const chipActiveClass =
  "inline-flex shrink-0 items-center rounded-full border border-navy bg-navy px-3 py-1.5 text-sm font-medium text-white shadow-sm";

export const sectionTitleClass = "font-serif text-2xl text-navy sm:text-3xl";

export const linkAccentClass =
  "font-semibold text-lake-dark underline-offset-2 transition-colors hover:text-lake hover:underline";

export function Flash({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-lake/25 bg-teal-soft px-3.5 py-2.5 text-sm text-lake-dark" role="status">
      {children}
    </p>
  );
}

export function ErrorNote({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p className="rounded-xl border border-danger/25 bg-red-50 px-3.5 py-2.5 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`${cardClass} border-dashed bg-paper/60 px-6 py-10 text-center`}>
      <p className="font-serif text-xl text-navy">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink/65">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

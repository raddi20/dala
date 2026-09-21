export const fieldClass =
  "mt-1 w-full rounded-lg border border-sand bg-white px-3 py-2 text-base text-ink";

export const btnPrimary =
  "inline-flex items-center justify-center rounded-lg bg-lake px-4 py-2.5 text-sm font-semibold text-white hover:bg-lake-dark disabled:opacity-60";

export const btnSecondary =
  "inline-flex items-center justify-center rounded-lg border border-sand bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-sand disabled:opacity-60";

export const btnDanger =
  "inline-flex items-center justify-center rounded-lg border border-danger/40 bg-white px-4 py-2.5 text-sm font-semibold text-danger hover:bg-red-50 disabled:opacity-60";

export function Flash({ children }: { children: string }) {
  return (
    <p className="rounded-lg border border-lake/30 bg-lake/10 px-3 py-2 text-sm text-lake-dark" role="status">
      {children}
    </p>
  );
}

export function ErrorNote({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p className="rounded-lg border border-danger/30 bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}

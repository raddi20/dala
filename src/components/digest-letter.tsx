/** The Monday note, as plain text, on paper. Nothing is sent from this view. */
export function DigestLetter({ text }: { text: string }) {
  return (
    <article data-digest-letter="" className="min-w-0 overflow-hidden rounded-[14px] border border-line bg-card shadow-[var(--shadow-card)]">
      <header className="border-b border-line bg-navy px-4 py-3 text-white">
        <p className="font-serif text-lg">Rangach</p>
        <p className="text-xs text-gold-l">New from shops you follow</p>
      </header>
      <pre className="max-w-full whitespace-pre-wrap break-words px-4 py-4 font-sans text-sm leading-relaxed text-ink">{text}</pre>
    </article>
  );
}

import { appName } from "@/lib/brand";

export function GateMark({
  className = "h-9 w-9",
  tone = "badge",
}: {
  className?: string;
  tone?: "badge" | "onDark";
}) {
  const cream = "#fbf1dc";
  const amber = "#c8881a";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      {tone === "badge" ? <rect width="32" height="32" rx="8" fill="#1a2436" /> : null}
      <path d="M9.5 26V13.2" stroke={cream} strokeWidth="2" strokeLinecap="round" />
      <path d="M22.5 26V13.2" stroke={cream} strokeWidth="2" strokeLinecap="round" />
      <path d="M9.5 13.4c0-4.6 13-4.6 13 0" stroke={cream} strokeWidth="2" strokeLinecap="round" />
      <path d="M9.5 16.4h13" stroke={amber} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({
  size = "md",
  tone = "default",
}: {
  size?: "md" | "lg";
  tone?: "default" | "onDark";
}) {
  const name = appName();
  const markClass = size === "lg" ? "h-11 w-11 shrink-0" : "h-9 w-9 shrink-0";
  const wordClass =
    size === "lg"
      ? "truncate font-serif text-3xl font-semibold tracking-tight"
      : "truncate font-serif text-xl font-semibold tracking-tight";
  const color = tone === "onDark" ? "text-white" : "text-navy";
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <GateMark
        tone={tone === "onDark" ? "onDark" : "badge"}
        className={`${markClass} transition-transform duration-150 group-hover:scale-[1.03]`}
      />
      <span className={`${wordClass} ${color}`}>{name}</span>
    </span>
  );
}

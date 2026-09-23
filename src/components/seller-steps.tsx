const STEPS = [
  {
    title: "Create your shop",
    body: "The page uses your profile name. WhatsApp on that profile is how buyers reach you.",
  },
  {
    title: "Add a first offering",
    body: "A title, a price, a short line, and a photo from your phone if you have one. Free shops list 5 offerings. Verified Pro lists 20.",
  },
  {
    title: "Publish",
    body: "Buyers with the link can open the shop and message you on WhatsApp.",
  },
] as const;

export function SellerSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="grid gap-3">
      {STEPS.map((step, index) => {
        const n = (index + 1) as 1 | 2 | 3;
        const state = n < current ? "done" : n === current ? "current" : "upcoming";
        return (
          <li key={step.title} className="flex gap-3" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={
                state === "done"
                  ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-soft text-sm font-semibold text-lake-dark ring-1 ring-lake/20"
                  : state === "current"
                    ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white"
                    : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-paper text-sm font-semibold text-ink/45 ring-1 ring-sand"
              }
            >
              {state === "done" ? "✓" : n}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={state === "upcoming" ? "font-semibold text-ink/50" : "font-semibold text-navy"}>{step.title}</p>
              <p className={state === "upcoming" ? "text-sm text-ink/45" : "text-sm text-ink/65"}>{step.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

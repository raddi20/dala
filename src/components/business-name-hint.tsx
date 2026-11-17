import { looksLikeUsername } from "@/lib/business-name";

/** Gentle nudge. A handle such as kevo_254 gets a firmer line. Saving is never blocked. */
export function BusinessNameHint({ name }: { name: string }) {
  const rough = looksLikeUsername(name);
  return (
    <span className={rough ? "mt-1 block text-xs font-medium text-clay" : "mt-1 block text-xs text-ink/60"}>
      {rough
        ? "That reads like a username. A tidy business name, such as Akinyi Catering, is easier to trust than kevo_254."
        : "A tidy business name is easier to trust. Words a buyer would say, such as Akinyi Catering, work better than a username like kevo_254."}
    </span>
  );
}

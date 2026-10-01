/** Wrap user text so the model treats it as data. Tags inside the text are removed. */
export function wrapUntrusted(label: string, text: string): string {
  const safeLabel = label.replace(/[^a-z0-9_-]/gi, "") || "data";
  const stripped = text.replace(/<[^>]*>/g, "").replace(/[<>]/g, "");
  return `<${safeLabel}>\n${stripped}\n</${safeLabel}>`;
}

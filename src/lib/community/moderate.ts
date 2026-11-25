export type UpdateFlag = {
  kind: string;
  severity: "low" | "medium" | "high";
  reason: string;
};

/** Medium and high flags stay off the shop page until an admin approves. */
export function holdForFlags(flags: UpdateFlag[]): { hold: boolean; reason: string } {
  const serious = flags.filter((flag) => flag.severity === "medium" || flag.severity === "high");
  if (serious.length === 0) return { hold: false, reason: "" };
  const reason = serious[0]?.reason.trim() || "Held for a moderator.";
  return { hold: true, reason: reason.slice(0, 200) };
}

export type UpdateJudgement = {
  status: "approved" | "pending";
  reason: string;
  flags: UpdateFlag[];
};

export type ModerationRun = {
  ok: true;
  data: { flags: UpdateFlag[] };
} | {
  ok: false;
};

/**
 * Reuses the existing moderation result shape (text and, when a photo was
 * attached, the image the caller already passed in). A failed model call does
 * not hold the note: the money, phone, and politics checks already ran.
 */
export function judgementFromModeration(result: ModerationRun | null): UpdateJudgement {
  if (!result || !result.ok) return { status: "approved", reason: "", flags: [] };
  const decision = holdForFlags(result.data.flags);
  if (!decision.hold) return { status: "approved", reason: "", flags: [] };
  return {
    status: "pending",
    reason: decision.reason,
    flags: result.data.flags.filter((flag) => flag.severity === "medium" || flag.severity === "high"),
  };
}

export type TipEmail = {
  to: string;
  name: string;
  subject: string;
  text: string;
};

export function parseEmailFrom(value: string): { address: string; name: string } | null {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^(.*)<([^>]+)>$/);
  const address = (wrapped?.[2] ?? trimmed).trim();
  const name = (wrapped?.[1] ?? "Rangach").trim().replace(/^"|"$/g, "") || "Rangach";
  if (!address.includes("@")) return null;
  return { address, name };
}

export function canSendTips(env: NodeJS.ProcessEnv = process.env): boolean {
  const from = parseEmailFrom(env.EMAIL_FROM ?? "");
  return env.TIPS_EMAIL === "1" && Boolean(env.ZEPTOMAIL_TOKEN?.trim()) && Boolean(from);
}

/** Sends one plain-text email. Returns skipped when the flag or ZeptoMail settings are missing. */
export async function sendTipEmail(
  message: TipEmail,
  deps: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<"sent" | "skipped" | "failed"> {
  const env = deps.env ?? process.env;
  const token = env.ZEPTOMAIL_TOKEN?.trim() ?? "";
  const from = parseEmailFrom(env.EMAIL_FROM ?? "");
  if (!canSendTips(env) || !from) return "skipped";
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: {
        Authorization: `Zoho-enczapikey ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { address: from.address, name: from.name },
        to: [{ email_address: { address: message.to, name: message.name || message.to } }],
        subject: message.subject,
        textbody: message.text,
      }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export type TipEmail = {
  to: string;
  name: string;
  subject: string;
  text: string;
};

export function canSendTips(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TIPS_EMAIL === "1" && Boolean(env.ZEPTOMAIL_TOKEN?.trim()) && Boolean(env.EMAIL_FROM?.trim());
}

export function cronAuthorized(request: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.CRON_SECRET?.trim() ?? "";
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Sends one plain-text email. Returns skipped when the flag or ZeptoMail settings are missing. */
export async function sendTipEmail(
  message: TipEmail,
  deps: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {},
): Promise<"sent" | "skipped" | "failed"> {
  const env = deps.env ?? process.env;
  const token = env.ZEPTOMAIL_TOKEN?.trim() ?? "";
  const from = env.EMAIL_FROM?.trim() ?? "";
  if (!canSendTips(env)) return "skipped";
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("https://api.zeptomail.com/v1.1/email", {
      method: "POST",
      headers: {
        Authorization: `Zoho-enczapikey ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { address: from, name: "Rangach" },
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

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

export function canSendMail(env: NodeJS.ProcessEnv = process.env): boolean {
  const from = parseEmailFrom(env.EMAIL_FROM ?? "");
  return Boolean(env.ZEPTOMAIL_TOKEN?.trim()) && Boolean(from);
}

export function canSendTips(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TIPS_EMAIL === "1" && canSendMail(env);
}

type MailDeps = { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch };

/** Password reset and any other transactional note. Does not require TIPS_EMAIL. */
export async function sendMail(message: TipEmail, deps: MailDeps = {}): Promise<"sent" | "skipped" | "failed"> {
  const env = deps.env ?? process.env;
  if (!canSendMail(env)) return "skipped";
  return postZepto(message, env, deps.fetchImpl ?? fetch);
}

/** Weekly seller tips. Returns skipped when the flag or ZeptoMail settings are missing. */
export async function sendTipEmail(message: TipEmail, deps: MailDeps = {}): Promise<"sent" | "skipped" | "failed"> {
  const env = deps.env ?? process.env;
  if (!canSendTips(env)) return "skipped";
  return postZepto(message, env, deps.fetchImpl ?? fetch);
}

async function postZepto(
  message: TipEmail,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<"sent" | "failed"> {
  const token = env.ZEPTOMAIL_TOKEN?.trim() ?? "";
  const from = parseEmailFrom(env.EMAIL_FROM ?? "");
  if (!from || !token) return "failed";
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

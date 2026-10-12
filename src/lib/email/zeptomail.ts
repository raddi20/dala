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

/** EU data centre. US accounts set ZEPTOMAIL_API_URL to https://api.zeptomail.com/v1.1/email. */
export const ZEPTOMAIL_EU_URL = "https://api.zeptomail.eu/v1.1/email";

const FAILURE_BODY_MAX = 2048;

export function zeptoApiUrl(env: NodeJS.ProcessEnv): string {
  const configured = env.ZEPTOMAIL_API_URL?.trim();
  return configured || ZEPTOMAIL_EU_URL;
}

/** Trim, then drop one leading Zoho-enczapikey prefix so the header is not doubled. */
export function zeptoSendToken(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^zoho-enczapikey\s+/i, "").trim();
}

export function canSendMail(env: NodeJS.ProcessEnv = process.env): boolean {
  const from = parseEmailFrom(env.EMAIL_FROM ?? "");
  return Boolean(zeptoSendToken(env.ZEPTOMAIL_TOKEN)) && Boolean(from);
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
  const token = zeptoSendToken(env.ZEPTOMAIL_TOKEN);
  const from = parseEmailFrom(env.EMAIL_FROM ?? "");
  if (!from || !token) return "failed";
  try {
    const response = await fetchImpl(zeptoApiUrl(env), {
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
    if (response.ok) return "sent";
    console.error("ZeptoMail send failed", response.status, await failureBody(response, token));
    return "failed";
  } catch {
    return "failed";
  }
}

async function failureBody(response: Response, token: string): Promise<string> {
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }
  const header = `Zoho-enczapikey ${token}`;
  const redacted = body.split(header).join("[redacted]").split(token).join("[redacted]");
  return redacted.slice(0, FAILURE_BODY_MAX);
}

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

/** Setting names only. Never includes the token or the from-address. */
export function mailConfigProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  if (!zeptoSendToken(env.ZEPTOMAIL_TOKEN)) problems.push("ZEPTOMAIL_TOKEN missing");
  if (!parseEmailFrom(env.EMAIL_FROM ?? "")) problems.push("EMAIL_FROM missing/invalid (no @)");
  return problems;
}

export function zeptoSkipLine(problems: string[]): string {
  return `ZeptoMail skipped: ${problems.join("; ")}`;
}

export function zeptoAttemptLine(endpoint: string, result: "sent" | "failed", status: number | null): string {
  return status == null ? `ZeptoMail ${endpoint} ${result}` : `ZeptoMail ${endpoint} ${result} ${status}`;
}

export function canSendMail(env: NodeJS.ProcessEnv = process.env): boolean {
  return mailConfigProblems(env).length === 0;
}

export function canSendTips(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.TIPS_EMAIL === "1" && canSendMail(env);
}

type MailDeps = { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch };

export type MailDelivery = {
  result: "sent" | "skipped" | "failed";
  endpoint: string;
  status: number | null;
  body: string;
  problems: string[];
};

/** Password reset and any other transactional note. Does not require TIPS_EMAIL. */
export async function sendMail(message: TipEmail, deps: MailDeps = {}): Promise<"sent" | "skipped" | "failed"> {
  return (await deliverMail(message, deps)).result;
}

/** Same send as sendMail, including the HTTP status and redacted response body. */
export async function deliverMail(message: TipEmail, deps: MailDeps = {}): Promise<MailDelivery> {
  const env = deps.env ?? process.env;
  const endpoint = zeptoApiUrl(env);
  const problems = mailConfigProblems(env);
  if (problems.length > 0) {
    console.warn(zeptoSkipLine(problems));
    return { result: "skipped", endpoint, status: null, body: "", problems };
  }
  return postZepto(message, env, deps.fetchImpl ?? fetch);
}

/** Weekly seller tips. Returns skipped when the flag or ZeptoMail settings are missing. */
export async function sendTipEmail(message: TipEmail, deps: MailDeps = {}): Promise<"sent" | "skipped" | "failed"> {
  const env = deps.env ?? process.env;
  if (env.TIPS_EMAIL !== "1") {
    console.warn(zeptoSkipLine(["TIPS_EMAIL off", ...mailConfigProblems(env)]));
    return "skipped";
  }
  return sendMail(message, deps);
}

async function postZepto(message: TipEmail, env: NodeJS.ProcessEnv, fetchImpl: typeof fetch): Promise<MailDelivery> {
  const token = zeptoSendToken(env.ZEPTOMAIL_TOKEN);
  const from = parseEmailFrom(env.EMAIL_FROM ?? "");
  const endpoint = redactSecrets(zeptoApiUrl(env), secretValues(env, token));
  if (!from || !token) {
    const problems = mailConfigProblems(env);
    console.warn(zeptoSkipLine(problems));
    return { result: "skipped", endpoint, status: null, body: "", problems };
  }
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
    const body = await failureBody(response, secretValues(env, token));
    if (response.ok) {
      console.info(zeptoAttemptLine(endpoint, "sent", response.status));
      return { result: "sent", endpoint, status: response.status, body, problems: [] };
    }
    console.error("ZeptoMail send failed", response.status, body);
    console.info(zeptoAttemptLine(endpoint, "failed", response.status));
    return { result: "failed", endpoint, status: response.status, body, problems: [] };
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    const message = redactSecrets(error instanceof Error ? error.message : "send failed", secretValues(env, token));
    console.error("ZeptoMail send failed", name, message, endpointHost(endpoint));
    console.info(zeptoAttemptLine(endpoint, "failed", null));
    return { result: "failed", endpoint, status: null, body: "", problems: [] };
  }
}

function secretValues(env: NodeJS.ProcessEnv, token: string): string[] {
  return [env.ZEPTOMAIL_TOKEN ?? "", token];
}

function redactSecrets(text: string, secrets: string[]): string {
  const unique = [...new Set(secrets.map((secret) => secret.trim()).filter((secret) => secret.length >= 4))];
  unique.sort((a, b) => b.length - a.length);
  let safe = text;
  for (const secret of unique) {
    safe = safe.split(`Zoho-enczapikey ${secret}`).join("[redacted]");
    safe = safe.split(secret).join("[redacted]");
  }
  return safe;
}

function endpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

async function failureBody(response: Response, secrets: string[]): Promise<string> {
  let body = "";
  try {
    body = await response.text();
  } catch {
    body = "";
  }
  const redacted = redactSecrets(body, secrets);
  if (redacted.length <= FAILURE_BODY_MAX) return redacted;
  return `${redacted.slice(0, FAILURE_BODY_MAX - 1)}…`;
}

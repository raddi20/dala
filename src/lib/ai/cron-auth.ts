export function cronAuthorized(request: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.CRON_SECRET?.trim() ?? "";
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

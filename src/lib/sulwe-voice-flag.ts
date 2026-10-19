/** Tiny on purpose: the main bundle imports only this. The voice code loads lazily. */
const ON = new Set(["1", "true", "yes", "on"]);

/** Off unless NEXT_PUBLIC_SULWE_VOICE is 1, true, yes, or on. */
export function sulweVoiceOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return ON.has((env.NEXT_PUBLIC_SULWE_VOICE ?? "").trim().toLowerCase());
}

export function voiceQueryOn(search: string): boolean {
  const query = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(query).get("voice") === "1";
}

export const SULWE_VOICE_PREVIEW_KEY = "rangach_sulwe_voice_preview";

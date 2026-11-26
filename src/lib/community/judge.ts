import { isAllowedListingPhotoUrl, downloadListingPhoto, resizeListingPhoto } from "@/lib/ai/resize-photo";
import { moderationPrompt } from "@/lib/ai/prompts/moderation";
import { runAi } from "@/lib/ai/run";
import type { ImagePart } from "@/lib/ai/types";
import { judgementFromModeration, type ModerationRun, type UpdateJudgement } from "@/lib/community/moderate";

export async function judgeShopUpdate(
  input: { body: string; photoUrl: string; authorId: string },
  deps: {
    env?: NodeJS.ProcessEnv;
    run?: (text: string, photo: ImagePart | null) => Promise<ModerationRun>;
    download?: (url: string) => Promise<Uint8Array>;
    resize?: (bytes: Uint8Array) => Promise<Uint8Array>;
  } = {},
): Promise<UpdateJudgement> {
  const env = deps.env ?? process.env;
  if (env.AI_MODERATION !== "1") return { status: "approved", reason: "", flags: [] };
  let photo: ImagePart | null = null;
  if (input.photoUrl && isAllowedListingPhotoUrl(input.photoUrl)) {
    try {
      const download = deps.download ?? downloadListingPhoto;
      const resize = deps.resize ?? resizeListingPhoto;
      photo = { mimeType: "image/jpeg", data: await resize(await download(input.photoUrl)) };
    } catch {
      photo = null;
    }
  }
  const run =
    deps.run ??
    (async (text: string, image: ImagePart | null) => {
      const result = await runAi(moderationPrompt, { text, photo: image }, { userId: input.authorId }, { env });
      if (!result.ok) return { ok: false as const };
      return { ok: true as const, data: { flags: result.data.flags } };
    });
  try {
    return judgementFromModeration(await run(input.body, photo));
  } catch {
    return { status: "approved", reason: "", flags: [] };
  }
}

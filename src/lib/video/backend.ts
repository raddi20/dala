import { videoMode } from "@/lib/video/config";

export type DirectUpload = { uploadId: string; url: string };

export type ReviewTokens = { playback: string; thumbnail: string };

/**
 * The only Mux calls in the app go through this interface.
 * Tests and MUX_MOCK=1 pass a fake. Live mode is loaded only when keys exist.
 */
export type VideoBackend = {
  kind: "mock" | "live";
  createDirectUpload(input: { corsOrigin: string; passthrough: string }): Promise<DirectUpload>;
  ensurePlaybackRestriction(domains: string[]): Promise<string>;
  addPublicPlayback(input: { assetId: string; restrictionId: string }): Promise<string>;
  signReviewTokens(playbackId: string): Promise<ReviewTokens | null>;
  deleteAsset(assetId: string): Promise<void>;
  requestModeration(input: { assetId: string; videoId: string }): Promise<void>;
};

export async function getVideoBackend(): Promise<VideoBackend | null> {
  const mode = videoMode();
  if (mode === "off") return null;
  if (mode === "mock") {
    const { mockBackend } = await import("@/lib/video/mock-backend");
    return mockBackend;
  }
  const { liveBackend } = await import("@/lib/video/mux-backend");
  return liveBackend;
}

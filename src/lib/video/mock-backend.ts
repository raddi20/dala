import { randomUUID } from "node:crypto";
import type { VideoBackend } from "@/lib/video/backend";

const deleted = new Set<string>();

/** In-memory stand-in. No network. The sample file in /mock is what the player shows. */
export const mockBackend: VideoBackend = {
  kind: "mock",
  async createDirectUpload() {
    const uploadId = `mockup_${randomUUID()}`;
    return { uploadId, url: `/api/mux/mock-upload?upload=${encodeURIComponent(uploadId)}` };
  },
  async ensurePlaybackRestriction() {
    return "mock_restriction";
  },
  async addPublicPlayback({ assetId }) {
    return `mockpub_${assetId}`;
  },
  async signReviewTokens() {
    return { playback: "mock-playback-token", thumbnail: "mock-thumbnail-token" };
  },
  async deleteAsset(assetId) {
    deleted.add(assetId);
  },
  async requestModeration() {
    return undefined;
  },
};

export function mockDeletedAssets() {
  return [...deleted];
}

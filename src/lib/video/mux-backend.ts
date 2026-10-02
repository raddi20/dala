import Mux from "@mux/mux-node";
import { playbackReferrerDomains, signingConfigured } from "@/lib/video/config";
import { REVIEW_TOKEN_TTL } from "@/lib/video/constants";
import type { VideoBackend } from "@/lib/video/backend";

let client: Mux | null = null;
let restrictionCache: { key: string; id: string } | null = null;

function mux() {
  if (client) return client;
  const tokenId = process.env.MUX_TOKEN_ID?.trim();
  const tokenSecret = process.env.MUX_TOKEN_SECRET?.trim();
  if (!tokenId || !tokenSecret) throw new Error("Mux API tokens are not set.");
  client = new Mux({ tokenId, tokenSecret });
  return client;
}

function sameDomains(left: readonly string[], right: readonly string[]) {
  const a = [...left].map((item) => item.toLowerCase()).sort();
  const b = [...right].map((item) => item.toLowerCase()).sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

export const liveBackend: VideoBackend = {
  kind: "live",
  async createDirectUpload({ corsOrigin, passthrough }) {
    const upload = await mux().video.uploads.create({
      cors_origin: corsOrigin,
      timeout: 21_600,
      new_asset_settings: {
        playback_policies: ["signed"],
        video_quality: "basic",
        // The API accepts 720p. The SDK's type list stops at 1080p.
        max_resolution_tier: "720p" as "1080p",
        passthrough,
        master_access: "none",
      },
    });
    if (!upload.url) throw new Error("Mux did not return an upload URL.");
    return { uploadId: upload.id, url: upload.url };
  },
  async ensurePlaybackRestriction(domains) {
    const key = [...domains].sort().join(",");
    if (restrictionCache?.key === key) return restrictionCache.id;
    for await (const item of mux().video.playbackRestrictions.list({ limit: 25 })) {
      const allowed = item.referrer?.allowed_domains ?? [];
      if (item.referrer?.allow_no_referrer === false && sameDomains(allowed, domains)) {
        restrictionCache = { key, id: item.id };
        return item.id;
      }
    }
    const created = await mux().video.playbackRestrictions.create({
      referrer: { allowed_domains: domains, allow_no_referrer: false },
      user_agent: { allow_high_risk_user_agent: false, allow_no_user_agent: false },
    });
    restrictionCache = { key, id: created.id };
    return created.id;
  },
  async addPublicPlayback({ assetId, restrictionId }) {
    const playback = await mux().video.assets.createPlaybackId(assetId, {
      policy: "public",
      playback_restriction_id: restrictionId,
    } as never);
    return playback.id;
  },
  async signReviewTokens(playbackId) {
    if (!signingConfigured()) return null;
    const keyId = process.env.MUX_SIGNING_KEY_ID?.trim();
    const keySecret = process.env.MUX_SIGNING_PRIVATE_KEY?.trim();
    const playback = await mux().jwt.signPlaybackId(playbackId, {
      type: "video",
      expiration: REVIEW_TOKEN_TTL,
      keyId,
      keySecret,
    });
    const thumbnail = await mux().jwt.signPlaybackId(playbackId, {
      type: "thumbnail",
      expiration: REVIEW_TOKEN_TTL,
      keyId,
      keySecret,
    });
    return { playback, thumbnail };
  },
  async deleteAsset(assetId) {
    if (!assetId) return;
    await mux().video.assets.delete(assetId);
  },
  async requestModeration({ assetId, videoId }) {
    await mux().robots.jobs.moderate.create({
      parameters: { asset_id: assetId },
      passthrough: videoId,
    });
  },
};

export function liveReferrerDomains() {
  return playbackReferrerDomains();
}

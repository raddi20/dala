import { PLAY_DATA_LABEL } from "@/lib/video/constants";
import { shopVideoIsPublic } from "@/lib/video/machine";

export { shopVideoIsPublic, PLAY_DATA_LABEL };

export type SellerVideoState = {
  mode: "off" | "mock" | "live";
  live: { caption: string } | null;
  review: { status: string; rejectReason: string; caption: string } | null;
};

export function sellerVideoNotices(state: SellerVideoState): string[] {
  if (state.mode === "off") return ["Shop video is coming soon."];
  const notices: string[] = [];
  if (state.review?.status === "pending") {
    notices.push(
      state.live
        ? "A new video is waiting for review. The video already on your shop stays up until this one is approved."
        : "Your video is waiting for review. It stays private until an admin approves it.",
    );
  } else if (state.review?.status === "uploading" || state.review?.status === "processing") {
    notices.push("Your upload is being prepared. You can leave this page.");
  } else if (state.review?.status === "rejected") {
    notices.push(`Not approved: ${state.review.rejectReason || "An admin rejected this video."}`);
  } else if (state.review?.status === "errored") {
    notices.push(state.review.rejectReason || "The upload did not finish. You can try again.");
  }
  if (state.live && !state.review) {
    notices.push("Your video is on the shop.");
  }
  if (state.live && state.review?.status === "rejected") {
    notices.push("The video already on your shop was not changed.");
  }
  return notices;
}

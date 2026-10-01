"use client";

import Link from "next/link";
import { useState } from "react";
import { btnPrimary, fieldClass, labelClass } from "@/components/ui";
import { CAPTION_MAX, MAX_DURATION_SECONDS, MAX_UPLOAD_BYTES, isAcceptedVideoFile } from "@/lib/video/constants";

type Props = {
  disabledReason: string;
};

type Phase = "idle" | "checking" | "uploading" | "done" | "error";

function readDuration(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    const finish = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

export function ShopVideoUpload({ disabledReason }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [chunkSizeKb, setChunkSizeKb] = useState(5120);

  async function startUpload(chosen: File, existingUrl: string) {
    setPhase("checking");
    setMessage("");
    setProgress(0);
    if (!isAcceptedVideoFile(chosen.name, chosen.type)) {
      setPhase("error");
      setMessage("Use an MP4 or MOV file. iPhone video is fine.");
      return;
    }
    if (chosen.size > MAX_UPLOAD_BYTES) {
      setPhase("error");
      setMessage("That video is over 200 MB. Trim it and try again.");
      return;
    }
    const duration = await readDuration(chosen);
    if (duration !== null && duration > MAX_DURATION_SECONDS) {
      setPhase("error");
      setMessage("Shop videos can be up to 45 seconds.");
      return;
    }

    const form = document.getElementById("shop-video-form");
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    const consent = data.get("consent") === "on";
    const caption = String(data.get("caption") ?? "");
    if (!consent) {
      setPhase("error");
      setMessage("Tick the box to confirm you have the rights and consent.");
      return;
    }

    let endpoint = existingUrl;
    let chunk = chunkSizeKb;
    if (!endpoint) {
      const response = await fetch("/api/video/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consent: true,
          fileName: chosen.name,
          mimeType: chosen.type,
          sizeBytes: chosen.size,
          durationSeconds: duration,
          caption,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; uploadUrl?: string; chunkSizeKb?: number } | null;
      if (!response.ok || !payload?.uploadUrl) {
        setPhase("error");
        setMessage(payload?.error || "Could not start the upload.");
        return;
      }
      endpoint = payload.uploadUrl;
      chunk = payload.chunkSizeKb || chunk;
      setUploadUrl(endpoint);
      setChunkSizeKb(chunk);
    }

    setPhase("uploading");
    setMessage(duration === null ? "Length will be checked after upload. Keep this page open." : "Uploading. If the connection drops, it retries.");
    try {
      const { createUpload } = await import("@mux/upchunk");
      const upload = createUpload({
        endpoint,
        file: chosen,
        chunkSize: chunk,
        attempts: 6,
        delayBeforeAttempt: 2,
        dynamicChunkSize: false,
      });
      upload.on("progress", (event) => {
        const value = typeof event.detail === "number" ? event.detail : 0;
        setProgress(Math.max(1, Math.min(100, Math.round(value))));
      });
      upload.on("error", (event) => {
        const detail = event.detail as { message?: string } | undefined;
        setPhase("error");
        setMessage(detail?.message || "The upload stopped. Check your connection and try again. It continues from the last finished piece.");
      });
      upload.on("success", () => {
        setProgress(100);
        setPhase("done");
        setMessage("Uploaded. It stays private until an admin approves it. If you already have a video on the shop, that one stays up until this one is approved.");
        setUploadUrl("");
      });
    } catch {
      setPhase("error");
      setMessage("The uploader could not start. Check your connection and try again.");
    }
  }

  if (disabledReason) {
    return <p className="text-sm text-ink/75">{disabledReason}</p>;
  }

  return (
    <form
      id="shop-video-form"
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (!file || phase === "uploading" || phase === "checking") return;
        void startUpload(file, uploadUrl);
      }}
    >
      <label className={labelClass} htmlFor="shop-video-file">
        Video file
        <input
          id="shop-video-file"
          name="file"
          type="file"
          accept="video/mp4,video/quicktime,video/hevc,.mp4,.mov,.m4v"
          className="mt-1 block w-full text-sm"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setUploadUrl("");
            setPhase("idle");
            setMessage("");
            setProgress(0);
          }}
        />
      </label>
      <p className="text-sm text-ink/60">MP4 or MOV, including iPhone video. Up to 45 seconds and 200 MB. The file goes straight to the video host, not through this site.</p>
      <label className={labelClass} htmlFor="shop-video-caption">
        Caption <span className="font-normal text-ink/50">(optional, used as the description)</span>
        <input id="shop-video-caption" name="caption" maxLength={CAPTION_MAX} className={fieldClass} placeholder="What is in this video?" />
      </label>
      <label className="flex items-start gap-2 text-sm text-ink/80" htmlFor="shop-video-consent">
        <input id="shop-video-consent" name="consent" type="checkbox" className="mt-1" required />
        <span>
          I have the rights to this video and any music in it, and I have the consent of anyone who is shown.{" "}
          <Link href="/video-policy" className="font-semibold text-lake-dark hover:text-lake">
            Video policy
          </Link>
        </span>
      </label>
      {phase === "uploading" || progress > 0 ? (
        <div>
          <div
            className="h-2 overflow-hidden rounded-full bg-sand"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Upload progress"
          >
            <div className="h-full bg-lake" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-sm text-ink/70">{progress}%</p>
        </div>
      ) : null}
      {message ? (
        <p className={phase === "error" ? "text-sm text-danger" : "text-sm text-ink/75"} role={phase === "error" ? "alert" : "status"}>
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button className={btnPrimary} type="submit" disabled={!file || phase === "uploading" || phase === "checking"}>
          {phase === "uploading" ? "Uploading…" : phase === "checking" ? "Checking…" : uploadUrl ? "Retry upload" : "Upload video"}
        </button>
      </div>
    </form>
  );
}

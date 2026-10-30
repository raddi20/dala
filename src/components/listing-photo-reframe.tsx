"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PhotoEditorHost } from "@/components/photo-field";
import { btnSecondary } from "@/components/ui";
import { replaceListingPhoto } from "@/lib/actions/listing-photo";
import { blobHost } from "@/lib/image-variants";
import { LISTING_PHOTO_ASPECT_CLASS } from "@/lib/listing-photo-frame";
import { fileFromListingPhoto, uploadPhoto } from "@/lib/prepare-photo";

export function ListingPhotoReframe({ listingId, photoUrl }: { listingId: string; photoUrl: string }) {
  const router = useRouter();
  const lock = useRef(false);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "opening" | "saving">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [failedUrl, setFailedUrl] = useState("");
  const currentUrl = savedUrl ?? photoUrl;
  const previewFailed = failedUrl === currentUrl;

  const stored = blobHost(currentUrl);
  const busy = phase !== "idle" || Boolean(pendingFile);

  async function reframe() {
    if (!stored || lock.current) return;
    lock.current = true;
    setError("");
    setMessage("");
    setPhase("opening");
    try {
      const file = await fileFromListingPhoto(listingId, currentUrl);
      setPendingFile(file);
    } catch (openError) {
      lock.current = false;
      setError(openError instanceof Error ? openError.message : "Could not open that photo.");
    } finally {
      setPhase("idle");
    }
  }

  function cancel() {
    lock.current = false;
    setPendingFile(null);
  }

  async function saveFramedPhoto(file: File) {
    setPendingFile(null);
    setPhase("saving");
    setError("");
    setMessage("");
    try {
      const next = await uploadPhoto(file, "listing", listingId);
      const saved = await replaceListingPhoto(listingId, next);
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      setSavedUrl(next);
      setFailedUrl("");
      setMessage("Photo updated.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save that photo.");
    } finally {
      lock.current = false;
      setPhase("idle");
    }
  }

  const showPreview = stored && !previewFailed;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <div
        className={`relative w-28 shrink-0 overflow-hidden rounded-xl border border-line/80 bg-sand ${LISTING_PHOTO_ASPECT_CLASS}`}
      >
        {showPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setFailedUrl(currentUrl)}
          />
        ) : null}
      </div>
      <div className="grid justify-items-start gap-1">
        {stored ? (
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => void reframe()}>
            {phase === "opening" ? "Opening photo…" : phase === "saving" ? "Saving photo…" : "Reframe photo"}
          </button>
        ) : (
          <p className="text-sm text-ink/60">
            {currentUrl ? "This photo is a link, so it cannot be reframed here." : "No photo"}
          </p>
        )}
        {stored ? <p className="max-w-sm text-xs text-ink/55">Pan and crop. The card and the listing page use this same frame.</p> : null}
        {message ? (
          <p className="text-sm text-lake-dark" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {pendingFile ? (
        <PhotoEditorHost
          file={pendingFile}
          purpose="listing"
          onUse={(prepared) => void saveFramedPhoto(prepared)}
          onCancel={cancel}
        />
      ) : null}
    </div>
  );
}

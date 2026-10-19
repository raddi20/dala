"use client";

import { Component, useEffect, useId, useRef, useState, type ComponentType, type ReactNode } from "react";
import { IMAGE_ACCEPT, clientImageChoiceError } from "@/lib/image-file";
import { uploadPhoto } from "@/lib/prepare-photo";
import type { UploadPurpose } from "@/lib/image-upload";
import { fieldClass } from "@/components/ui";

type EditorComponent = ComponentType<{
  file: File;
  purpose: UploadPurpose;
  onUse: (file: File) => void;
  onCancel: () => void;
}>;

function loadEditor() {
  return import("@/components/photo-editor").then((mod) => mod.PhotoEditor);
}

function EditorOpening() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy px-6 text-center text-white" role="status">
      Opening the editor…
    </div>
  );
}

class EditorBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy px-6 text-center text-white" role="alert">
          <div className="max-w-xs">
            <p>The editor did not open. Connect once so it can be saved on this phone, then try again.</p>
            <button type="button" className="mt-4 min-h-11 rounded-full bg-white px-4 text-sm font-semibold text-navy" onClick={this.props.onClose}>
              Close
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function PhotoField({
  name,
  label,
  purpose,
  resourceId,
  defaultUrl = "",
  hint = "JPEG, PNG, or WebP. You can crop and brighten it before it uploads.",
  dataTour,
}: {
  name: string;
  label: string;
  purpose: UploadPurpose;
  resourceId?: string;
  defaultUrl?: string;
  hint?: string;
  dataTour?: string;
}) {
  const inputId = useId().replace(/:/g, "");
  const hintId = `${inputId}-hint`;
  const rootRef = useRef<HTMLDivElement>(null);
  const uploadingRef = useRef(false);
  const [url, setUrl] = useState(defaultUrl);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [chosen, setChosen] = useState(false);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [Editor, setEditor] = useState<EditorComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const load = () => {
      void loadEditor().then((component) => {
        if (!cancelled) setEditor(() => component);
      });
    };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(load);
      return () => {
        cancelled = true;
        win.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(load, 500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    function onSubmit(event: Event) {
      if (!uploadingRef.current) return;
      event.preventDefault();
      setError("Wait for the photo to finish uploading.");
    }
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  function stageFile(file: File | undefined) {
    if (!file || uploadingRef.current || pendingFile) return;
    const choice = clientImageChoiceError(file);
    if (choice) {
      setError(choice);
      return;
    }
    setError("");
    setPendingFile(file);
    if (!Editor) {
      void loadEditor().then((component) => setEditor(() => component));
    }
  }

  async function uploadPrepared(file: File) {
    setPendingFile(null);
    setError("");
    setUploading(true);
    uploadingRef.current = true;
    try {
      const next = await uploadPhoto(file, purpose, resourceId);
      setUrl(next);
      setChosen(true);
      setPreviewFailed(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not upload that photo.");
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      setDragging(false);
    }
  }

  const showPreview = Boolean(url) && /^https?:\/\//i.test(url) && !previewFailed;

  return (
    <div ref={rootRef} data-tour={dataTour} className="grid gap-2">
      <div className="block text-sm">
        <span className="font-medium">{label}</span>
        <label
          htmlFor={inputId}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
            setDragging(true);
          }}
          onDragLeave={(event) => {
            const next = event.relatedTarget;
            if (next instanceof Node && event.currentTarget.contains(next)) return;
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            stageFile(event.dataTransfer.files?.[0]);
          }}
          className={
            dragging
              ? "mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-lake bg-teal-soft/70 px-4 py-5 text-center"
              : "mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-sand bg-paper/60 px-4 py-5 text-center hover:border-navy/30"
          }
        >
          {showPreview ? (
            // User and Blob URLs are arbitrary hosts; next/image would need a remote allowlist.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt=""
              className="max-h-48 w-full rounded-xl object-cover"
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <span className="font-serif text-3xl text-navy/35" aria-hidden>
              +
            </span>
          )}
          <span className="text-sm font-semibold text-navy">
            {uploading ? "Uploading…" : url ? "Choose a different photo" : "Choose a photo"}
          </span>
          <span id={hintId} className="max-w-sm text-xs leading-relaxed text-ink/60">
            {hint}
          </span>
          <input
            id={inputId}
            type="file"
            accept={IMAGE_ACCEPT}
            disabled={uploading || Boolean(pendingFile)}
            aria-describedby={hintId}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              stageFile(file);
            }}
          />
        </label>
      </div>
      {url ? (
        <button
          type="button"
          className="justify-self-start text-sm font-semibold text-ink/70 hover:text-ink"
          onClick={() => {
            setUrl("");
            setChosen(true);
            setError("");
            setPreviewFailed(false);
          }}
        >
          Remove photo
        </button>
      ) : null}
      {chosen ? (
        <p className="text-sm text-ink/70" role="status">
          {url
            ? "New photo selected. Save the form to keep it."
            : "Photo cleared. Save the form to keep that change."}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-danger/25 bg-red-50 px-3.5 py-2.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <details className="text-sm">
        <summary className="cursor-pointer text-ink/60">Paste a photo URL instead</summary>
        <label className="mt-2 block">
          Photo URL
          <input
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setChosen(true);
              setPreviewFailed(false);
              setError("");
            }}
            placeholder="https://"
            maxLength={2000}
            autoComplete="off"
            spellCheck={false}
            className={fieldClass}
          />
        </label>
        <p className="mt-1 text-xs text-ink/55">For a link you already have, including demo photos. Uploading from this device is the usual way.</p>
      </details>
      {url && !/^https?:\/\//i.test(url.trim()) ? (
        <p className="text-xs text-danger">Photo URL must start with http:// or https://.</p>
      ) : null}
      <input type="hidden" name={name} value={url} />
      {pendingFile ? (
        <EditorBoundary onClose={() => setPendingFile(null)}>
          {Editor ? (
            <Editor
              key={`${pendingFile.name}-${pendingFile.size}-${pendingFile.lastModified}`}
              file={pendingFile}
              purpose={purpose}
              onUse={(prepared) => void uploadPrepared(prepared)}
              onCancel={() => setPendingFile(null)}
            />
          ) : (
            <EditorOpening />
          )}
        </EditorBoundary>
      ) : null}
    </div>
  );
}

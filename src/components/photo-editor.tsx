"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { btnPrimary } from "@/components/ui";
import type { UploadPurpose } from "@/lib/image-upload";
import {
  STRAIGHTEN_MAX,
  aspectPresets,
  clamp,
  defaultEdit,
  editForSave,
  type AspectPreset,
  type PhotoEdit,
  type QualityWarning,
} from "@/lib/photo-edit";
import { decodePhoto, finalizePhoto, paintPreview, warningsFromPreview, type DecodedPhoto } from "@/lib/photo-render";

const TIPS = ["Use daylight", "Plain background", "Fill the frame", "Hold steady"];

type Gesture = {
  mode: "pan" | "pinch";
  panX: number;
  panY: number;
  zoom: number;
  x: number;
  y: number;
  dist: number;
};

function presetNote(purpose: UploadPurpose) {
  if (purpose === "banner") return "Cover is the wide photo at the top of the shop.";
  if (purpose === "avatar") return "Square fits the round shop logo.";
  return "Square fits the cards.";
}

export function PhotoEditor({
  file,
  purpose,
  onUse,
  onCancel,
}: {
  file: File;
  purpose: UploadPurpose;
  onUse: (file: File) => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const tipsId = useId();
  const brightnessId = useId();
  const warmthId = useId();
  const straightenId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const decodedRef = useRef<DecodedPhoto | null>(null);
  const editRef = useRef<PhotoEdit>(defaultEdit(purpose));
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const cancelRef = useRef(onCancel);

  const [edit, setEdit] = useState<PhotoEdit>(() => defaultEdit(purpose));
  const [status, setStatus] = useState<"reading" | "ready" | "saving" | "error">("reading");
  const [message, setMessage] = useState("");
  const [warnings, setWarnings] = useState<QualityWarning[]>([]);
  const [compare, setCompare] = useState(false);

  useEffect(() => {
    editRef.current = edit;
  }, [edit]);

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    let cancelled = false;
    void decodePhoto(file)
      .then((decoded) => {
        if (cancelled) {
          decoded.close();
          return;
        }
        decodedRef.current?.close();
        decodedRef.current = decoded;
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMessage(error instanceof Error ? error.message : "Could not read that photo.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => () => decodedRef.current?.close(), []);

  useEffect(() => {
    const root = dialogRef.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [...root.querySelectorAll<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])")].filter(
        (el) => !el.hasAttribute("disabled"),
      );
    focusable()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelRef.current();
        return;
      }
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);

  useEffect(() => {
    const decoded = decodedRef.current;
    const canvas = canvasRef.current;
    if (!decoded || !canvas || status !== "ready") return;
    let frame: { cropWidth: number; cropHeight: number };
    try {
      frame = paintPreview(canvas, decoded.bitmap, { width: decoded.width, height: decoded.height }, edit, compare);
    } catch {
      return;
    }
    const timer = window.setTimeout(() => {
      const live = canvasRef.current;
      if (!live) return;
      setWarnings(warningsFromPreview(live, { width: frame.cropWidth, height: frame.cropHeight }));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [edit, compare, status]);

  async function save(action: "as-is" | "save") {
    const decoded = decodedRef.current;
    if (!decoded || status !== "ready") return;
    setStatus("saving");
    setMessage("");
    try {
      const prepared = await finalizePhoto(decoded, editForSave(action, editRef.current));
      onUse(prepared);
    } catch (error) {
      setStatus("ready");
      setMessage(error instanceof Error ? error.message : "Could not prepare that photo.");
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (status !== "ready") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = editRef.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        mode: "pinch",
        panX: current.panX,
        panY: current.panY,
        zoom: current.zoom,
        x: 0,
        y: 0,
        dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      };
      return;
    }
    gesture.current = {
      mode: "pan",
      panX: current.panX,
      panY: current.panY,
      zoom: current.zoom,
      x: event.clientX,
      y: event.clientY,
      dist: 1,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const active = gesture.current;
    if (active.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      setEdit((prev) => ({ ...prev, zoom: clamp((active.zoom * dist) / active.dist, 1, 4) }));
      return;
    }
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage || stage.width < 1 || stage.height < 1) return;
    const dx = (event.clientX - active.x) / stage.width;
    const dy = (event.clientY - active.y) / stage.height;
    setEdit((prev) => ({
      ...prev,
      panX: clamp(active.panX - dx * 2, -1, 1),
      panY: clamp(active.panY - dy * 2, -1, 1),
    }));
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      return;
    }
    const point = [...pointers.current.values()][0];
    const current = editRef.current;
    gesture.current = {
      mode: "pan",
      panX: current.panX,
      panY: current.panY,
      zoom: current.zoom,
      x: point.x,
      y: point.y,
      dist: 1,
    };
  }

  function onStageKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (status !== "ready") return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setEdit((prev) => ({ ...prev, panX: clamp(prev.panX - 0.08, -1, 1) }));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setEdit((prev) => ({ ...prev, panX: clamp(prev.panX + 0.08, -1, 1) }));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setEdit((prev) => ({ ...prev, panY: clamp(prev.panY - 0.08, -1, 1) }));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setEdit((prev) => ({ ...prev, panY: clamp(prev.panY + 0.08, -1, 1) }));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setEdit((prev) => ({ ...prev, zoom: clamp(prev.zoom * 1.1, 1, 4) }));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setEdit((prev) => ({ ...prev, zoom: clamp(prev.zoom / 1.1, 1, 4) }));
    }
  }

  const busy = status !== "ready";
  const presets = aspectPresets(purpose);

  function chooseAspect(aspect: AspectPreset) {
    setEdit((prev) => ({ ...prev, aspect, zoom: 1, panX: 0, panY: 0 }));
  }

  const dialog = (
    <div className="fixed inset-0 z-[70] bg-navy sm:flex sm:items-center sm:justify-center sm:bg-navy/70 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={tipsId}
        aria-busy={status === "reading" || status === "saving"}
        className="flex h-full w-full flex-col bg-navy sm:h-auto sm:max-h-[92vh] sm:max-w-md sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl"
      >
        <div
          className="grid grid-cols-[auto_1fr_auto] items-center gap-1 px-2 text-white"
          style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
        >
          <button type="button" className="min-h-11 px-2 text-sm font-semibold text-white/85" onClick={onCancel}>
            Cancel
          </button>
          <h2 id={titleId} className="text-center font-serif text-lg">
            Edit photo
          </h2>
          <button
            type="button"
            className="min-h-11 rounded-full px-3 text-sm font-semibold text-white underline decoration-white/50 underline-offset-4 disabled:opacity-50"
            disabled={busy}
            onClick={() => void save("as-is")}
          >
            Use as is
          </button>
        </div>
        <div className="relative min-h-[34vh] flex-1 px-3 py-2 sm:min-h-64">
          <div
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Crop. Drag to move, pinch to zoom. Arrow keys move. Plus and minus zoom."
            className="flex h-full touch-none items-center justify-center overflow-hidden rounded-xl bg-black/40 outline-none focus-visible:ring-2 focus-visible:ring-white"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onKeyDown={onStageKey}
          >
            <canvas ref={canvasRef} className="max-h-full max-w-full" />
          </div>
          {status === "reading" ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white" role="status">
              Reading photo…
            </p>
          ) : null}
        </div>
        <div
          className="max-h-[58vh] overflow-y-auto rounded-t-2xl bg-card px-4 pt-4 text-ink sm:max-h-[50vh]"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {warnings.length > 0 ? (
            <div className="mb-3 grid gap-2" role="status">
              {warnings.map((warning) => (
                <p key={warning.id} className="rounded-xl bg-amber-soft px-3 py-2 text-sm text-ink">
                  <span className="font-semibold">{warning.message}</span> {warning.tip}
                </p>
              ))}
            </div>
          ) : null}
          {message ? (
            <p className="mb-3 rounded-xl border border-danger/25 bg-red-50 px-3 py-2 text-sm text-danger" role="alert">
              {message}
            </p>
          ) : null}
          <p className="text-xs text-ink/60">Drag to move. Pinch to zoom.</p>
          <div role="group" aria-label="Crop shape" className="mt-2 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={edit.aspect === preset.id}
                aria-label={preset.hint}
                disabled={busy}
                className={
                  edit.aspect === preset.id
                    ? "min-h-11 rounded-full bg-navy px-4 text-sm font-semibold text-white"
                    : "min-h-11 rounded-full bg-paper px-4 text-sm font-semibold text-ink ring-1 ring-sand"
                }
                onClick={() => chooseAspect(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink/60">{presetNote(purpose)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-xl bg-paper px-4 text-sm font-semibold text-ink ring-1 ring-sand disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                setEdit((prev) => ({ ...prev, quarterTurns: (prev.quarterTurns + 1) % 4, zoom: 1, panX: 0, panY: 0 }))
              }
            >
              Rotate 90°
            </button>
            <button
              type="button"
              className={
                edit.enhance
                  ? "min-h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50"
                  : "min-h-11 rounded-xl bg-paper px-4 text-sm font-semibold text-ink ring-1 ring-sand disabled:opacity-50"
              }
              aria-pressed={edit.enhance}
              disabled={busy}
              onClick={() => setEdit((prev) => ({ ...prev, enhance: !prev.enhance }))}
            >
              Enhance
            </button>
          </div>
          <label className="mt-3 block text-sm font-medium" htmlFor={straightenId}>
            Straighten
            <input
              id={straightenId}
              type="range"
              min={-STRAIGHTEN_MAX}
              max={STRAIGHTEN_MAX}
              step={1}
              value={edit.straighten}
              disabled={busy}
              aria-valuetext={`${edit.straighten} degrees`}
              className="mt-1 h-11 w-full accent-lake"
              onChange={(event) => setEdit((prev) => ({ ...prev, straighten: Number(event.target.value) }))}
            />
          </label>
          <label className="mt-1 block text-sm font-medium" htmlFor={brightnessId}>
            Brightness
            <input
              id={brightnessId}
              type="range"
              min={-100}
              max={100}
              step={1}
              value={Math.round(edit.brightness * 100)}
              disabled={busy}
              aria-valuetext={`Brightness ${Math.round(edit.brightness * 100)}`}
              className="mt-1 h-11 w-full accent-lake"
              onChange={(event) => setEdit((prev) => ({ ...prev, brightness: Number(event.target.value) / 100 }))}
            />
          </label>
          <label className="mt-1 block text-sm font-medium" htmlFor={warmthId}>
            Warmth
            <input
              id={warmthId}
              type="range"
              min={-100}
              max={100}
              step={1}
              value={Math.round(edit.warmth * 100)}
              disabled={busy}
              aria-valuetext={`Warmth ${Math.round(edit.warmth * 100)}`}
              className="mt-1 h-11 w-full accent-lake"
              onChange={(event) => setEdit((prev) => ({ ...prev, warmth: Number(event.target.value) / 100 }))}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-ink ring-1 ring-sand disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                setEdit(defaultEdit(purpose));
                setCompare(false);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="min-h-11 rounded-xl bg-paper px-4 text-sm font-semibold text-ink ring-1 ring-sand disabled:opacity-50"
              aria-pressed={compare}
              disabled={busy}
              onPointerDown={() => setCompare(true)}
              onPointerUp={() => setCompare(false)}
              onPointerLeave={() => setCompare(false)}
              onPointerCancel={() => setCompare(false)}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  setCompare(true);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") setCompare(false);
              }}
            >
              Hold to compare
            </button>
          </div>
          <ul id={tipsId} className="mt-3 grid grid-cols-2 gap-1 text-xs text-ink/70">
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <button
            type="button"
            className={`${btnPrimary} mt-4 min-h-12 w-full text-base`}
            disabled={busy}
            onClick={() => void save("save")}
          >
            {status === "saving" ? "Preparing…" : "Use this photo"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { btnPrimary } from "@/components/ui";
import type { UploadPurpose } from "@/lib/image-upload";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  STRAIGHTEN_MAX,
  aspectPresets,
  clamp,
  defaultEdit,
  editForSave,
  fitRect,
  panAfterDrag,
  type AspectPreset,
  type Frame,
  type PhotoEdit,
  type QualityWarning,
  type Size,
} from "@/lib/photo-edit";
import { decodePhoto, finalizePhoto, paintPreview, warningsFromPreview, type DecodedPhoto } from "@/lib/photo-render";

const TIPS = ["Use daylight", "Plain background", "Fill the frame", "Hold steady"];
const GRID_KEY = "dala.photoGrid";
const ZOOM_STEP = 1.2;

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
  // The 3x3 grid is on by default and remembers the last choice on this phone.
  const [grid, setGrid] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(GRID_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const [outSize, setOutSize] = useState<Size>({ width: 4, height: 3 });
  const frameRef = useRef<Frame | null>(null);
  const zoomId = useId();

  useEffect(() => {
    editRef.current = edit;
  }, [edit]);

  function toggleGrid() {
    setGrid((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(GRID_KEY, next ? "on" : "off");
      } catch {
        // Not saved, still toggles for this edit.
      }
      return next;
    });
  }

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      // The stage has 8px of padding inside its box; the preview fits the inner area.
      setStageSize({ width: Math.max(0, rect.width - 16), height: Math.max(0, rect.height - 16) });
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

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
    let frame: Frame;
    try {
      frame = paintPreview(canvas, decoded.bitmap, { width: decoded.width, height: decoded.height }, edit, compare);
    } catch {
      return;
    }
    frameRef.current = frame;
    setOutSize((prev) =>
      prev.width === frame.outputWidth && prev.height === frame.outputHeight
        ? prev
        : { width: frame.outputWidth, height: frame.outputHeight },
    );
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

  function displayRect() {
    return fitRect(stageSize, outSize);
  }

  function setZoom(next: number) {
    setEdit((prev) => ({ ...prev, zoom: clamp(next, MIN_ZOOM, MAX_ZOOM) }));
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
      setEdit((prev) => ({ ...prev, zoom: clamp((active.zoom * dist) / active.dist, MIN_ZOOM, MAX_ZOOM) }));
      return;
    }
    const frame = frameRef.current;
    if (!frame) return;
    const next = panAfterDrag(
      active,
      { x: event.clientX - active.x, y: event.clientY - active.y },
      frame,
      displayRect(),
    );
    setEdit((prev) => ({ ...prev, panX: next.panX, panY: next.panY }));
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

  function onWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (status !== "ready" || event.deltaY === 0) return;
    setEdit((prev) => ({
      ...prev,
      zoom: clamp(event.deltaY < 0 ? prev.zoom * 1.08 : prev.zoom / 1.08, MIN_ZOOM, MAX_ZOOM),
    }));
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
      setEdit((prev) => ({ ...prev, zoom: clamp(prev.zoom * 1.1, MIN_ZOOM, MAX_ZOOM) }));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      setEdit((prev) => ({ ...prev, zoom: clamp(prev.zoom / 1.1, MIN_ZOOM, MAX_ZOOM) }));
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
        className="flex h-full w-full flex-col bg-navy sm:h-auto sm:max-h-[94vh] sm:max-w-2xl sm:overflow-hidden sm:rounded-2xl sm:shadow-2xl"
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
        <div className="relative flex min-h-[40vh] flex-1 flex-col px-3 py-2 sm:min-h-[26rem]">
          <div
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Crop. Drag to move, pinch to zoom. Arrow keys move. Plus and minus zoom."
            className="flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden rounded-xl bg-black/40 p-2 outline-none focus-visible:ring-2 focus-visible:ring-white"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onWheel={onWheel}
            onKeyDown={onStageKey}
          >
            <div
              className="relative shrink-0 overflow-hidden"
              style={
                stageSize.width > 0
                  ? { width: displayRect().width, height: displayRect().height }
                  : { width: "100%", height: "100%" }
              }
              data-testid="photo-frame"
            >
              <canvas ref={canvasRef} className="block h-full w-full" />
              {grid ? (
                <div
                  className="pointer-events-none absolute inset-0"
                  data-testid="photo-grid"
                  aria-hidden="true"
                >
                  <span className="absolute inset-y-0 left-1/3 w-px bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
                  <span className="absolute inset-y-0 left-2/3 w-px bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
                  <span className="absolute inset-x-0 top-1/3 h-px bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
                  <span className="absolute inset-x-0 top-2/3 h-px bg-white/70 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
                  <span className="absolute inset-0 border border-white/50" />
                </div>
              ) : null}
            </div>
          </div>
          {status === "reading" ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-white" role="status">
              Reading photo…
            </p>
          ) : null}
        </div>
        <div
          className="max-h-[44vh] overflow-y-auto rounded-t-2xl bg-card px-4 pt-4 text-ink sm:max-h-[34vh]"
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
          <p className="text-xs text-ink/60">Your whole photo is shown. Drag to move. Pinch or use the zoom bar to zoom in.</p>
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
              className={
                edit.fit === "contain"
                  ? "min-h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50"
                  : "min-h-11 rounded-xl bg-paper px-4 text-sm font-semibold text-ink ring-1 ring-sand disabled:opacity-50"
              }
              aria-pressed={edit.fit === "contain"}
              disabled={busy}
              onClick={() =>
                setEdit((prev) => ({ ...prev, fit: prev.fit === "contain" ? "cover" : "contain", zoom: 1, panX: 0, panY: 0 }))
              }
            >
              Show whole photo
            </button>
            <button
              type="button"
              className={
                grid
                  ? "min-h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white disabled:opacity-50"
                  : "min-h-11 rounded-xl bg-paper px-4 text-sm font-semibold text-ink ring-1 ring-sand disabled:opacity-50"
              }
              aria-pressed={grid}
              disabled={busy}
              onClick={toggleGrid}
            >
              Grid
            </button>
          </div>
          {edit.fit === "contain" ? (
            <div role="group" aria-label="Padding style" className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink/60">Empty space:</span>
              {(["blur", "neutral"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={edit.padding === style}
                  disabled={busy}
                  className={
                    edit.padding === style
                      ? "min-h-11 rounded-full bg-navy px-4 text-sm font-semibold text-white"
                      : "min-h-11 rounded-full bg-paper px-4 text-sm font-semibold text-ink ring-1 ring-sand"
                  }
                  onClick={() => setEdit((prev) => ({ ...prev, padding: style }))}
                >
                  {style === "blur" ? "Blurred" : "Neutral"}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-ink/60">Filling the frame. Parts of the photo outside the frame are cut off.</p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              aria-label="Zoom out"
              className="min-h-11 min-w-11 rounded-xl bg-paper text-lg font-semibold text-ink ring-1 ring-sand disabled:opacity-50"
              disabled={busy || edit.zoom <= MIN_ZOOM}
              onClick={() => setZoom(edit.zoom / ZOOM_STEP)}
            >
              −
            </button>
            <label className="sr-only" htmlFor={zoomId}>
              Zoom
            </label>
            <input
              id={zoomId}
              type="range"
              min={MIN_ZOOM * 100}
              max={MAX_ZOOM * 100}
              step={1}
              value={Math.round(edit.zoom * 100)}
              disabled={busy}
              aria-valuetext={`Zoom ${Math.round(edit.zoom * 100)} percent`}
              className="h-11 min-w-0 flex-1 accent-lake"
              onChange={(event) => setZoom(Number(event.target.value) / 100)}
            />
            <button
              type="button"
              aria-label="Zoom in"
              className="min-h-11 min-w-11 rounded-xl bg-paper text-lg font-semibold text-ink ring-1 ring-sand disabled:opacity-50"
              disabled={busy || edit.zoom >= MAX_ZOOM}
              onClick={() => setZoom(edit.zoom * ZOOM_STEP)}
            >
              +
            </button>
          </div>
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
          <details className="mt-3 rounded-xl ring-1 ring-sand">
            <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-semibold text-ink">Straighten and colour</summary>
            <div className="px-3 pb-2">
          <label className="block text-sm font-medium" htmlFor={straightenId}>
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
            </div>
          </details>
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

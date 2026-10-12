import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/** WCAG relative luminance and contrast for the gold and WhatsApp pairs. */
function channel(hex: string) {
  const value = Number.parseInt(hex, 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const raw = hex.replace("#", "");
  const r = channel(raw.slice(0, 2));
  const g = channel(raw.slice(2, 4));
  const b = channel(raw.slice(4, 6));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test("navy on gold and white on WhatsApp green clear WCAG AA", () => {
  assert.ok(contrast("#1a2436", "#c8881a") >= 4.5);
  assert.ok(contrast("#9a6412", "#ffffff") >= 4.5);
  assert.ok(contrast("#e9b85c", "#1a2436") >= 4.5);
  assert.ok(contrast("#ffffff", "#0b7a5f") >= 4.5);
  assert.ok(contrast("#ffffff", "#c8881a") < 4.5);
});

test("the shell does not download a web font", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../components/ui.tsx", import.meta.url), "utf8");
  assert.equal(layout.includes("next/font"), false);
  assert.equal(css.includes("radial-gradient"), false);
  assert.match(css, /Georgia/);
  assert.match(css, /system-ui/);
  assert.match(css, /prefers-reduced-motion:\s*no-preference/);
  assert.match(ui, /bg-gold[\s\S]*text-navy/);
  assert.match(ui, /bg-wa/);
  assert.match(ui, /min-h-11/);
});

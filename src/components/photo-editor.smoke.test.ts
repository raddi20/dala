import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PhotoEditor } from "./photo-editor";

test("editor shell shows crop, enhance, compare, tips, and use as is", () => {
  const html = renderToStaticMarkup(
    createElement(PhotoEditor, {
      file: new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])], "plate.jpg", { type: "image/jpeg" }),
      purpose: "offering",
      onUse: () => undefined,
      onCancel: () => undefined,
    }),
  );
  assert.match(html, /Edit photo/);
  assert.match(html, /Use as is/);
  assert.match(html, /Square/);
  assert.match(html, /Original/);
  assert.doesNotMatch(html, />Cover</);
  assert.match(html, /Rotate 90/);
  assert.match(html, /Straighten/);
  assert.match(html, /Enhance/);
  assert.match(html, /Brightness/);
  assert.match(html, /Warmth/);
  assert.match(html, /Reset/);
  assert.match(html, /Hold to compare/);
  assert.match(html, /Use daylight/);
  assert.match(html, /Plain background/);
  assert.match(html, /Fill the frame/);
  assert.match(html, /Hold steady/);
  assert.match(html, /Use this photo/);
  assert.match(html, /Show whole photo/);
  assert.match(html, /aria-pressed="true"[^>]*>Show whole photo/);
  assert.match(html, /Blurred/);
  assert.match(html, /Neutral/);
  assert.match(html, /aria-label="Zoom in"/);
  assert.match(html, /aria-label="Zoom out"/);
  assert.match(html, /type="range"[^>]*min="100"[^>]*max="400"/);
  assert.match(html, />Grid</);
  assert.match(html, /data-testid="photo-grid"/);
  assert.match(html, /aria-modal="true"/);
});

test("a shop cover offers the banner crop", () => {
  const html = renderToStaticMarkup(
    createElement(PhotoEditor, {
      file: new File([Uint8Array.from([1, 2, 3])], "shop.jpg", { type: "image/jpeg" }),
      purpose: "banner",
      onUse: () => undefined,
      onCancel: () => undefined,
    }),
  );
  assert.match(html, />Cover</);
  assert.match(html, /Wide 2 to 1/);
});

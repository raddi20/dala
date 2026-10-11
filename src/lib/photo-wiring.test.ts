import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

const uploadPoints = [
  ["src/components/offering-form.tsx", 'purpose="offering"'],
  ["src/components/listing-form.tsx", 'purpose="listing"'],
  ["src/components/profile-form.tsx", 'purpose="avatar"'],
  ["src/components/storefront-settings-form.tsx", 'purpose="banner"'],
] as const;

function walk(dir: string, found: string[]) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, found);
    else if (/\.(tsx|ts)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) found.push(full);
  }
  return found;
}

test("every photo upload point uses the shared editor", () => {
  for (const [file, purpose] of uploadPoints) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /PhotoField/);
    assert.match(source, new RegExp(purpose));
    assert.doesNotMatch(source, /type="file"/);
  }
  const field = readFileSync(path.join(root, "src/components/photo-field.tsx"), "utf8");
  assert.match(field, /import\("@\/components\/photo-editor"\)/);
  assert.doesNotMatch(field, /from "@\/components\/photo-editor"/);
  assert.match(field, /requestIdleCallback|setTimeout/);

  const editor = readFileSync(path.join(root, "src/components/photo-editor.tsx"), "utf8");
  assert.match(editor, /Use as is/);
  assert.match(editor, /save\("as-is"\)/);
  assert.match(editor, /editForSave\(action/);
  assert.match(editor, /finalizePhoto/);
  assert.match(editor, /Hold to compare/);
  assert.match(editor, /Enhance/);
});

test("image file inputs only live in the shared photo field", () => {
  const files = walk(path.join(root, "src"), []);
  const inputs = files.filter((file) => /type="file"/.test(readFileSync(file, "utf8")));
  const relative = inputs.map((file) => path.relative(root, file)).sort();
  assert.deepEqual(relative, ["src/components/photo-field.tsx", "src/components/shop-video-upload.tsx"]);
});

test("saved photos are webp or jpeg and the server already accepts webp", () => {
  const allowed = readFileSync(path.join(root, "src/lib/image-file.ts"), "utf8");
  assert.match(allowed, /image\/webp/);
  const upload = readFileSync(path.join(root, "src/app/api/uploads/route.ts"), "utf8");
  assert.match(upload, /contentType: validated\.contentType/);
  assert.match(upload, /extensionForImageType/);
  const prepare = readFileSync(path.join(root, "src/lib/prepare-photo.ts"), "utf8");
  assert.doesNotMatch(prepare, /preparePhoto/);
  assert.match(prepare, /MAX_IMAGE_BYTES/);
});

/**
 * Local screenshots of the community layer. Production server on :3000, seeded file database.
 * Does not send mail or touch a hosted database.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const BASE = process.env.LAYOUT_BASE_URL || "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts/community";
const PHOTO = "https://images.unsplash.com/photo-1510130387422-82bed34b37e9?auto=format&fit=crop&w=1200&q=80";

async function signIn(page, email, next) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("demo1234");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20000 });
}

async function park(locator) {
  await locator.evaluate((el) => {
    const y = el.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo(0, Math.max(0, y));
  });
  await locator.page().waitForTimeout(150);
}
async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false, animations: "disabled" });
  console.log(name);
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const photoFile = "/tmp/rangach-omena.jpg";
const downloaded = await fetch(PHOTO);
if (!downloaded.ok) throw new Error("Could not fetch the sample photo");
await writeFile(photoFile, Buffer.from(await downloaded.arrayBuffer()));

for (const [label, width, height] of [
  ["390", 390, 844],
  ["1440", 1440, 900],
]) {
  const page = await (
    await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: "light" })
  ).newPage();

  await page.goto(`${BASE}/b/nyangoma-fish`, { waitUntil: "networkidle" });
  await page.locator("[data-follow-shop]").scrollIntoViewIfNeeded();
  await shot(page, `shop-${label}`);

  await page.goto(`${BASE}/listings/fixture_listing_tilapia`, { waitUntil: "networkidle" });
  await park(page.locator("[data-follow-shop]").first());
  await shot(page, `listing-${label}`);

  await signIn(page, "achieng.buyer@example.com", "/account");
  await park(page.locator("[data-followed-shops]"));
  await shot(page, `followed-${label}`);

  await signIn(page, "nyangoma@example.com", "/account");
  const composer = page.locator("[data-update-composer]");
  await park(composer);
  await shot(page, `composer-empty-${label}`);

  await page.locator("#shop-update-body").fill("Omena is in. Come by before noon.");
  await page.route("**/api/uploads", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: PHOTO }),
    }),
  );
  await composer.locator('input[type="file"]').setInputFiles(photoFile);
  await page.getByRole("button", { name: "Use as is" }).click();
  await composer.getByText("Photo ready. It goes up when you post.").waitFor({ timeout: 20000 });
  await park(page.locator("#shop-update-body"));
  await shot(page, `composer-filled-${label}`);

  await page.goto(`${BASE}/account`, { waitUntil: "networkidle" });
  await page.locator("#shop-update-body").fill("Send the money on M-Pesa 0712 345 678");
  await page.getByRole("button", { name: "Post update" }).click();
  await page.locator("[data-update-composer] [role='alert']").waitFor({ timeout: 15000 });
  await park(page.locator("[data-update-composer] [role='alert']"));
  await shot(page, `composer-error-${label}`);

  await signIn(page, "community.admin@example.com", "/admin/updates");
  await park(page.locator("[data-update-queue] article"));
  await shot(page, `admin-queue-${label}`);
  await park(page.locator("[data-digest-letter]"));
  await shot(page, `digest-${label}`);

  await page.context().close();
}

await browser.close();
console.log("screenshots written to", OUT);

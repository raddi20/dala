/**
 * Phone pages must not scroll sideways, and the floating stack must not cover
 * the footer's last row. Run against a local server:
 *   NEXT_PUBLIC_SULWE=1 NEXT_PUBLIC_GUIDED_TOUR=1 npm run build && npm start
 *   npm run test:layout
 */
import { chromium, webkit, devices } from "playwright";

const BASE = process.env.LAYOUT_BASE_URL || "http://127.0.0.1:3000";
const iphone = devices["iPhone 14"];

function fail(errors, message) {
  errors.push(message);
  console.error("FAIL", message);
}

async function metrics(page) {
  return page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const scroll = document.documentElement.scrollWidth;
    const chips = [...document.querySelectorAll("[data-understood-chips] a")].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: (el.textContent || "").trim().slice(0, 40), left: Math.round(r.left), right: Math.round(r.right) };
    });
    return { client, scroll, chips };
  });
}

async function footerHits(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const footer = document.querySelector("footer");
    if (!footer) return { missing: true, hits: [], last: [] };
    const links = [...footer.querySelectorAll("a, button")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const maxBottom = Math.max(...links.map((el) => el.getBoundingClientRect().bottom));
    const last = links.filter((el) => el.getBoundingClientRect().bottom >= maxBottom - 6);
    const floaters = [...document.querySelectorAll(".tour-prompt, [data-sulwe-root], [data-sulwe-ask], .bottom-nav, .sticky-cta-bar")].filter((el) => {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && r.width > 0 && r.height > 0;
    });
    const hits = [];
    for (const link of last) {
      const a = link.getBoundingClientRect();
      for (const floater of floaters) {
        const b = floater.getBoundingClientRect();
        const overlap = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        if (overlap) {
          hits.push({
            link: (link.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
            floater: (floater.getAttribute("data-sulwe-root") !== null ? "sulwe" : floater.className).toString().slice(0, 48),
          });
        }
      }
    }
    return {
      missing: false,
      hits,
      last: last.map((el) => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)),
    };
  });
}

async function firstHref(page, selector) {
  return page.locator(selector).first().getAttribute("href").catch(() => null);
}

const errors = [];

const phone = await webkit.launch();
const phonePage = await (
  await phone.newContext({ ...iphone, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "light" })
).newPage();
await phonePage.goto(`${BASE}/listings?nl=${encodeURIComponent("catering for an ayie")}&sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
await phonePage.waitForTimeout(400);
const search = await metrics(phonePage);
console.log("390 search", search.client, search.scroll, search.chips.map((chip) => chip.text).join(" | "));
if (search.scroll !== search.client) fail(errors, `390 search scrollWidth ${search.scroll} != viewport ${search.client}`);
for (const chip of search.chips) {
  if (chip.right > search.client + 1 || chip.left < -1) fail(errors, `390 chip off screen: ${chip.text} ${chip.left}-${chip.right}`);
}
const phoneFooter = await footerHits(phonePage);
if (phoneFooter.hits.length) fail(errors, `390 search footer overlap ${JSON.stringify(phoneFooter.hits)}`);
await phone.close();

const desk = await chromium.launch();
const deskPage = await (await desk.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" })).newPage();
await deskPage.goto(`${BASE}/shops`, { waitUntil: "domcontentloaded", timeout: 60000 });
const shopHref = await firstHref(deskPage, 'a[href^="/b/"]');
await deskPage.goto(`${BASE}/listings`, { waitUntil: "domcontentloaded", timeout: 60000 });
const listingHref = await firstHref(deskPage, 'a[href^="/listings/"]');
const pages = ["/", "/about", "/terms", "/privacy", "/listings?nl=catering%20for%20an%20ayie&sulwe=1", shopHref, listingHref].filter(Boolean);
for (const path of pages) {
  const url = path.startsWith("http") ? path : `${BASE}${path}${path.includes("?") ? "&" : "?"}sulwe=1`;
  const response = await deskPage.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  if (response && response.status() >= 400) {
    fail(errors, `1440 ${path} status ${response.status()}`);
    continue;
  }
  const width = await metrics(deskPage);
  if (width.scroll !== width.client) fail(errors, `1440 ${path} scrollWidth ${width.scroll} != viewport ${width.client}`);
  const footer = await footerHits(deskPage);
  console.log("1440", path, "last", footer.last.join(" | "), "hits", footer.hits.length);
  if (!footer.last.length) fail(errors, `1440 ${path} has no footer links`);
  if (footer.hits.length) fail(errors, `1440 ${path} footer overlap ${JSON.stringify(footer.hits)}`);
  const floating = await deskPage.locator("[data-sulwe-root], .tour-prompt").count();
  if (path === "/" && floating === 0) fail(errors, "1440 home shows neither Sulwe nor the tour line");
}
await desk.close();

async function moreMenu(browserType, label, width) {
  const browser = await browserType.launch();
  const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" })).newPage();
  await page.goto(`${BASE}/?sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
  const more = page.getByRole("button", { name: "More", exact: true });
  if ((await more.count()) === 0) {
    console.log(label, "More is hidden at this width");
    await browser.close();
    return;
  }
  const expanded = () => more.getAttribute("aria-expanded");
  const menu = page.locator("[data-more-menu]");
  await more.click();
  if ((await expanded()) !== "true" || (await menu.isHidden())) fail(errors, `${label} More did not open`);
  const overlap = await page.evaluate(() => {
    const panel = document.querySelector("[data-more-menu]");
    if (!panel || panel.hasAttribute("hidden")) return [];
    const a = panel.getBoundingClientRect();
    return [...document.querySelectorAll("[data-sulwe-root], .tour-prompt, [data-sulwe-ask]")].flatMap((el) => {
      const style = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      if (style.display === "none" || b.width === 0) return [];
      const hit = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return hit ? [el.className.toString().slice(0, 40)] : [];
    });
  });
  if (overlap.length) fail(errors, `${label} More menu overlaps the floating stack: ${overlap.join(", ")}`);
  await more.click();
  if ((await expanded()) !== "false" || (await menu.isHidden()) === false) fail(errors, `${label} second click did not close More`);
  await more.click();
  await page.locator("h1").click();
  if ((await expanded()) !== "false") fail(errors, `${label} outside click did not close More`);
  await more.focus();
  await page.keyboard.press("Enter");
  if ((await expanded()) !== "true") fail(errors, `${label} Enter did not open More`);
  await page.keyboard.press("ArrowDown");
  const firstItem = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40) ?? "");
  if (!firstItem || firstItem === "More") fail(errors, `${label} ArrowDown did not move into the menu (${firstItem})`);
  await page.keyboard.press("Escape");
  const focusName = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
  if ((await expanded()) !== "false" || focusName !== "More") fail(errors, `${label} Escape did not close More and return focus (${focusName})`);
  await more.click();
  await page.getByRole("menuitem", { name: "Saved" }).click();
  await page.waitForURL(/\/saved/, { timeout: 20000 });
  if (await page.locator("[data-more-menu]").isVisible().catch(() => false)) fail(errors, `${label} menu stayed open after an item click`);
  await page.goBack();
  await page.waitForURL((url) => !url.pathname.startsWith("/saved"), { timeout: 20000 });
  if (await page.locator("[data-more-menu]").isVisible().catch(() => false)) fail(errors, `${label} menu reopened after back`);
  await page.goto(`${BASE}/?sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
  await more.click();
  if ((await expanded()) !== "true") fail(errors, `${label} More did not reopen before scroll`);
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(150);
  if ((await expanded()) !== "false" || (await menu.isHidden()) === false) fail(errors, `${label} scroll did not close More`);
  console.log(label, "More menu closed on click, outside, Escape, item, back, and scroll");
  await browser.close();
}

await moreMenu(chromium, "chromium-1440", 1440);
await moreMenu(webkit, "webkit-1440", 1440);

if (errors.length) {
  console.error(`\n${errors.length} layout check(s) failed`);
  process.exit(1);
}
console.log("layout guard passed");

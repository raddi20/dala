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

async function communitySurface(browserType, label, width, height) {
  const browser = await browserType.launch();
  const page = await (
    await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: "light" })
  ).newPage();
  const shopUrl = `${BASE}/b/nyangoma-fish?sulwe=1`;
  const shopResponse = await page.goto(shopUrl, { waitUntil: "networkidle", timeout: 60000 });
  if (!shopResponse || shopResponse.status() >= 400) {
    fail(errors, `${label} shop status ${shopResponse ? shopResponse.status() : "none"}`);
    await browser.close();
    return;
  }
  const follow = page.locator("[data-follow-shop]").first();
  const updates = page.locator("[data-shop-updates]");
  if ((await follow.count()) === 0) fail(errors, `${label} shop has no follow control`);
  if ((await updates.count()) === 0) fail(errors, `${label} shop has no updates strip`);
  const shopWidth = await metrics(page);
  if (shopWidth.scroll !== shopWidth.client) {
    fail(errors, `${label} shop scrollWidth ${shopWidth.scroll} != viewport ${shopWidth.client}`);
  }
  const box = await follow.boundingBox();
  if (!box || box.height < 44 || box.width < 44) fail(errors, `${label} follow control is under 44px`);
  const covered = await page.evaluate(() => {
    function hits(selector) {
      const el = document.querySelector(selector);
      if (!el) return [`missing ${selector}`];
      const first = el.getBoundingClientRect();
      const top = window.scrollY + first.top - 96;
      window.scrollTo(0, Math.max(0, top));
      const a = el.getBoundingClientRect();
      const floaters = [...document.querySelectorAll(".bottom-nav, .sticky-cta-bar, [data-sulwe-root], [data-sulwe-ask], .tour-prompt")].filter((node) => {
        const style = getComputedStyle(node);
        const b = node.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && b.width > 0 && b.height > 0;
      });
      return floaters.flatMap((node) => {
        const b = node.getBoundingClientRect();
        const overlap = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        if (!overlap) return [];
        return [`${selector} covered by ${node.getAttribute("data-sulwe-root") !== null ? "sulwe" : node.className.toString().slice(0, 40)}`];
      });
    }
    return [...hits("[data-follow-shop]"), ...hits("[data-shop-updates] h2")];
  });
  if (covered.length) fail(errors, `${label} ${covered.join("; ")}`);

  const listingResponse = await page.goto(`${BASE}/listings/fixture_listing_tilapia?sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
  if (!listingResponse || listingResponse.status() >= 400) {
    fail(errors, `${label} listing status ${listingResponse ? listingResponse.status() : "none"}`);
  } else {
    const listingFollow = page.locator("[data-follow-shop]").first();
    if ((await listingFollow.count()) === 0) fail(errors, `${label} listing has no follow control`);
    const listingWidth = await metrics(page);
    if (listingWidth.scroll !== listingWidth.client) {
      fail(errors, `${label} listing scrollWidth ${listingWidth.scroll} != viewport ${listingWidth.client}`);
    }
    const listingCovered = await page.evaluate(() => {
      const el = document.querySelector("[data-follow-shop]");
      if (!el) return ["missing follow"];
      const first = el.getBoundingClientRect();
      window.scrollTo(0, Math.max(0, window.scrollY + first.top - 96));
      const a = el.getBoundingClientRect();
      return [...document.querySelectorAll(".bottom-nav, .sticky-cta-bar, [data-sulwe-root], [data-sulwe-ask], .tour-prompt")].flatMap((node) => {
        const style = getComputedStyle(node);
        const b = node.getBoundingClientRect();
        if (style.display === "none" || b.width === 0 || b.height === 0) return [];
        const overlap = a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        return overlap ? ["listing follow covered"] : [];
      });
    });
    if (listingCovered.length) fail(errors, `${label} ${listingCovered.join("; ")}`);
  }
  console.log(label, "follow and updates clear of the bottom stack");
  await browser.close();
}

const { spawnSync } = await import("node:child_process");
const fixture = spawnSync(process.execPath, ["--env-file=.env", "--import", "tsx", "scripts/community-fixture.ts"], {
  encoding: "utf8",
});
if (fixture.status !== 0) {
  const text = `${fixture.stdout || ""} ${fixture.stderr || ""}`;
  if (text.includes("Refusing community fixture")) {
    console.log("community layout checks skipped: local file database required");
  } else {
    fail(errors, `community fixture failed ${text}`);
  }
} else {
  await communitySurface(webkit, "390", 390, 844);
  await communitySurface(chromium, "1440", 1440, 900);
}

async function centreHits(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(80);
  return page.evaluate(() => {
    function one(selector) {
      const el = document.querySelector(selector);
      if (!el) return { selector, missing: true };
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const top = document.elementFromPoint(x, y);
      const hit = Boolean(top && (top === el || el.contains(top)));
      const inView = r.top >= -1 && r.left >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1;
      return {
        selector,
        hit,
        inView,
        tall: r.height >= 44 && r.width >= 44,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        target: top ? (top.closest("a, button")?.getAttribute("data-primary-action") || top.closest("a, button")?.getAttribute("aria-label") || top.textContent || "").toString().trim().replace(/\s+/g, " ").slice(0, 60) : "",
      };
    }
    return {
      save: one("[data-save-heart]"),
      follow: one("[data-follow-shop]"),
      call: one('[data-primary-action="call"]'),
      share: one('[data-primary-action="share"]'),
      banner: Boolean(document.querySelector("#install-hint")),
      tour: Boolean(document.querySelector("[data-tour-prompt]")),
    };
  });
}

async function checkedChip(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.evaluate(() => {
    const chip = [...document.querySelectorAll("[data-browse-chips] a")].find((el) => (el.textContent || "").trim() === "Checked");
    if (!chip) return { missing: true };
    const r = chip.getBoundingClientRect();
    let clipped = false;
    let node = chip.parentElement;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
      if (/auto|hidden|clip|scroll/.test(overflow)) {
        const b = node.getBoundingClientRect();
        if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1) clipped = true;
      }
      const mask = style.maskImage || style.webkitMaskImage || "none";
      if (mask !== "none") {
        const b = node.getBoundingClientRect();
        if (r.right > b.right - 20 || r.left < b.left + 2) clipped = true;
      }
      node = node.parentElement;
    }
    const y = r.top + r.height / 2;
    const centre = document.elementFromPoint(r.left + r.width / 2, y);
    const edge = document.elementFromPoint(Math.min(r.right - 3, window.innerWidth - 1), y);
    return {
      missing: false,
      clipped,
      inView: r.top >= -1 && r.left >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1,
      centerHit: Boolean(centre && chip.contains(centre)),
      edgeHit: Boolean(edge && chip.contains(edge)),
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
    };
  });
}

async function controlHits(page) {
  return page.evaluate(() => {
    const misses = [];
    const tabs = [];
    for (const el of document.querySelectorAll("a, button")) {
      const style = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
      if (r.width < 8 || r.height < 8) continue;
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (x < 1 || y < 1 || x > window.innerWidth - 1 || y > window.innerHeight - 1) continue;
      const top = document.elementFromPoint(x, y);
      const hit = Boolean(top && (top === el || el.contains(top)));
      const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
      const row = { label, hit };
      const tab = Boolean(el.closest("[data-shop-tabs]"));
      if (tab) tabs.push(row);
      const stack = top?.closest(".sticky-cta-bar, .bottom-nav");
      if (!hit && !(stack && !tab)) {
        const cover = top?.closest("[data-tour-prompt], .sticky-cta-bar, .bottom-nav, [data-sulwe-root], [data-sulwe-ask], a, button");
        misses.push({
          label,
          cover: (cover?.getAttribute("aria-label") || cover?.textContent || top?.tagName || "none").toString().trim().replace(/\s+/g, " ").slice(0, 48),
        });
      }
    }
    return { misses, tabs };
  });
}

function expectControls(name, report) {
  if (name.endsWith(" shop")) {
    if (report.tabs.length < 3) fail(errors, `${name} shop tabs missing ${JSON.stringify(report.tabs)}`);
    for (const tab of report.tabs) {
      if (!tab.hit) fail(errors, `${name} shop tab not hit ${tab.label}`);
    }
  }
  if (report.misses.length) fail(errors, `${name} link or button covered ${JSON.stringify(report.misses)}`);
}

async function expectDocked(page, name) {
  const dock = await page.evaluate(() => {
    const prompt = document.querySelector("[data-tour-prompt='sulwe']");
    const sulwe = document.querySelector("[data-sulwe-root]");
    if (!prompt || !sulwe) return { missing: true };
    const style = getComputedStyle(prompt);
    const hidden = style.visibility === "hidden" || style.display === "none";
    if (document.documentElement.getAttribute("data-tour-invite") === "dot" || hidden) return { collapsed: true };
    const pill = prompt.getBoundingClientRect();
    const host = sulwe.getBoundingClientRect();
    return {
      collapsed: false,
      gap: Math.round(host.left - pill.right),
      sameRow: pill.top < host.bottom - 4 && pill.bottom > host.top + 4,
    };
  });
  if (dock.missing) fail(errors, `${name} tour dock missing ${JSON.stringify(dock)}`);
  else if (!dock.collapsed && (dock.gap < -1 || dock.gap > 16 || !dock.sameRow)) {
    fail(errors, `${name} tour pill left Sulwe ${JSON.stringify(dock)}`);
  }
}

function expectHits(name, hits, keys, state) {
  if (Boolean(hits.banner) !== state.banner) fail(errors, `${name} install banner ${hits.banner ? "shown" : "hidden"}`);
  if (Boolean(hits.tour) !== state.tour) fail(errors, `${name} tour bubble ${hits.tour ? "shown" : "hidden"}`);
  for (const key of keys) {
    const row = hits[key];
    if (!row || row.missing) fail(errors, `${name} missing ${key}`);
    else if (!row.hit || !row.inView || !row.tall) fail(errors, `${name} ${key} not hit ${JSON.stringify(row)}`);
  }
}

async function hitPass(browserType, label, width, height) {
  const browser = await browserType.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: "light",
    userAgent: iphone.userAgent,
    hasTouch: true,
    isMobile: width < 768,
  });
  const page = await context.newPage();
  const states = [
    { banner: false, tour: false },
    { banner: true, tour: false },
    { banner: false, tour: true },
    { banner: true, tour: true },
  ];
  for (const state of states) {
    const name = `${label} banner ${state.banner ? "on" : "off"}, tour ${state.tour ? "on" : "off"}`;
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate((flags) => {
      localStorage.removeItem("rangach.pwa.installed");
      if (flags.banner) localStorage.removeItem("rangach.pwa.dismissedAt");
      else localStorage.setItem("rangach.pwa.dismissedAt", String(Date.now()));
      if (flags.tour) {
        localStorage.removeItem("rangach_tour_prompt_visitor");
        localStorage.removeItem("rangach_tour_prompt_seller");
        localStorage.removeItem("rangach_tour");
      } else {
        localStorage.setItem("rangach_tour_prompt_visitor", "no");
        localStorage.setItem("rangach_tour_prompt_seller", "no");
      }
    }, state);

    await page.goto(`${BASE}/b/nyangoma-fish?sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
    if (state.tour) {
      await page.waitForFunction(() => {
        const shown = (el) => el && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
        return shown(document.querySelector("[data-tour-prompt]")) || shown(document.querySelector("[data-tour-invite-dot]"));
      }, null, { timeout: 8000 });
    }
    if (state.banner) await page.locator("#install-hint").waitFor({ timeout: 8000 });
    await page.waitForTimeout(450);
    expectHits(`${name} shop`, await centreHits(page), ["call", "share"], state);
    expectControls(`${name} shop`, await controlHits(page));
    if (state.tour) await expectDocked(page, `${name} shop`);

    await page.goto(`${BASE}/listings/fixture_listing_tilapia?sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
    if (state.tour) {
      await page.waitForFunction(() => {
        const shown = (el) => el && getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
        return shown(document.querySelector("[data-tour-prompt]")) || shown(document.querySelector("[data-tour-invite-dot]"));
      }, null, { timeout: 8000 });
    }
    if (state.banner) await page.locator("#install-hint").waitFor({ timeout: 8000 });
    await page.waitForTimeout(450);
    expectHits(`${name} listing`, await centreHits(page), ["save", "follow"], state);
    expectControls(`${name} listing`, await controlHits(page));
    if (state.tour) await expectDocked(page, `${name} listing`);

    await page.goto(`${BASE}/listings?sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(250);
    const chip = await checkedChip(page);
    if (chip.missing || chip.clipped || !chip.inView || !chip.centerHit || !chip.edgeHit) {
      fail(errors, `${name} Checked chip ${JSON.stringify(chip)}`);
    } else {
      console.log(name, "Checked", chip.left, chip.right);
    }
  }
  console.log(label, "Save, Follow, Call, and Share are the elements under the pointer");
  await browser.close();
}

async function gridControlHits(page) {
  return page.evaluate(() => {
    const misses = [];
    const checked = { whatsapp: 0, link: 0 };
    const chrome = ".bottom-nav, .sticky-cta-bar, header, .results-search-bar";
    const root = document.querySelector("main") || document.body;
    for (const card of root.querySelectorAll("article, li")) {
      const whatsapp = card.querySelector('a[aria-label^="WhatsApp"]');
      const link = [...card.querySelectorAll('a[href^="/listings/"], a[href^="/b/"]')].find((el) => el !== whatsapp);
      const controls = [];
      if (whatsapp) controls.push(["whatsapp", whatsapp]);
      if (link) controls.push(["link", link]);
      for (const [kind, el] of controls) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const points = [
          [r.left + r.width / 2, r.top + r.height / 2],
          [r.left + 3, r.top + r.height / 2],
          [r.right - 3, r.top + r.height / 2],
          [r.left + r.width / 2, r.top + 3],
          [r.left + r.width / 2, r.bottom - 3],
        ].filter(([x, y]) => x >= 1 && y >= 1 && x <= window.innerWidth - 1 && y <= window.innerHeight - 1);
        if (!points.length) continue;
        checked[kind] += 1;
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 48);
        for (const [x, y] of points) {
          const top = document.elementFromPoint(x, y);
          if (!top || top.closest(chrome)) continue;
          const floater = top.closest("[data-sulwe-root], .sulwe-dock, [data-tour-prompt], [data-tour-invite-dot], [data-sulwe-ask]");
          const hit = top === el || el.contains(top);
          if (floater || !hit) {
            misses.push({
              kind,
              label,
              cover: floater
                ? floater.hasAttribute("data-tour-invite-dot")
                  ? "tour-dot"
                  : floater.hasAttribute("data-tour-prompt")
                    ? "tour-pill"
                    : "sulwe"
                : (top.closest("a, button")?.getAttribute("aria-label") || top.tagName || "none").toString().trim().slice(0, 40),
              x: Math.round(x),
              y: Math.round(y),
            });
          }
        }
      }
    }
    return { misses: misses.slice(0, 6), checked };
  });
}

async function sweepListingGrid(page, name) {
  const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
  const step = 140;
  const stops = [];
  for (let y = 0; y < max; y += step) stops.push(y);
  stops.push(max);
  const seen = { whatsapp: 0, link: 0 };
  for (const y of stops) {
    await page.evaluate(
      (top) =>
        new Promise((resolve) => {
          window.scrollTo(0, top);
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)));
        }),
      y,
    );
    const report = await gridControlHits(page);
    seen.whatsapp += report.checked.whatsapp;
    seen.link += report.checked.link;
    if (report.misses.length) fail(errors, `${name} scroll ${y} ${JSON.stringify(report.misses)}`);
  }
  return seen;
}

async function gridDockPass(browserType, label, width, height) {
  const browser = await browserType.launch();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: "light",
    userAgent: width < 768 ? iphone.userAgent : undefined,
    hasTouch: width < 768,
    isMobile: width < 768,
  });
  const page = await context.newPage();
  for (const hold of ["pill", "dot"]) {
    const name = `${label} tour ${hold}`;
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(() => {
      localStorage.removeItem("rangach_tour_prompt_visitor");
      localStorage.removeItem("rangach_tour_prompt_seller");
      localStorage.removeItem("rangach_tour");
      localStorage.setItem("rangach.pwa.dismissedAt", String(Date.now()));
    });
    await page.goto(`${BASE}/listings?sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate((mode) => {
      document.documentElement.setAttribute("data-tour-invite-hold", mode);
      window.dispatchEvent(new Event("resize"));
    }, hold);
    const ready = await page
      .waitForFunction(
        (mode) => {
          if (!document.querySelector("[data-tour-prompt='sulwe']")) return false;
          const invite = document.documentElement.getAttribute("data-tour-invite");
          return mode === "dot" ? invite === "dot" : invite !== "dot";
        },
        hold,
        { timeout: 8000 },
      )
      .then(() => true)
      .catch(() => false);
    if (!ready) {
      const state = await page.evaluate(() => ({
        prompt: Boolean(document.querySelector("[data-tour-prompt='sulwe']")),
        invite: document.documentElement.getAttribute("data-tour-invite"),
      }));
      fail(errors, `${name} invite not ready ${JSON.stringify(state)}`);
      continue;
    }
    const seen = await sweepListingGrid(page, name);
    if (seen.whatsapp < 1) fail(errors, `${name} saw no WhatsApp button`);
    if (seen.link < 1) fail(errors, `${name} saw no card link`);
    console.log(name, "whatsapp", seen.whatsapp, "links", seen.link);
  }
  await browser.close();
}

function sameSeat(a, b) {
  if (!a || !b) return false;
  return Math.abs(a.t - b.t) <= 1 && Math.abs(a.b - b.b) <= 1 && Math.abs(a.l - b.l) <= 1 && Math.abs(a.r - b.r) <= 1;
}

async function dockSeatPass(browserType, label) {
  const browser = await browserType.launch();
  const context = await browser.newContext({
    ...iphone,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();
  const paths = ["/", "/listings", "/b/nyangoma-fish"];
  for (const path of paths) {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.evaluate(() => {
      localStorage.removeItem("rangach_tour_prompt_visitor");
      localStorage.removeItem("rangach_tour_prompt_seller");
      localStorage.removeItem("rangach_tour");
      localStorage.setItem("rangach.pwa.dismissedAt", String(Date.now()));
    });
    await page.goto(`${BASE}${path}?sulwe=1`, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-tour-invite-hold", "pill");
      window.dispatchEvent(new Event("resize"));
    });
    const ready = await page
      .waitForFunction(() => document.querySelector("[data-sulwe-root]") && document.querySelector("[data-tour-prompt='sulwe']"), null, { timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (!ready) {
      fail(errors, `${label} ${path} dock missing`);
      continue;
    }
    const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
    const stops = [];
    for (let y = 0; y < max; y += 160) stops.push(y);
    stops.push(max);
    let seat = null;
    let sawYield = false;
    let sawVisible = false;
    for (const y of stops) {
      await page.evaluate(
        (top) =>
          new Promise((resolve) => {
            window.scrollTo(0, top);
            requestAnimationFrame(() => requestAnimationFrame(() => resolve(null)));
          }),
        y,
      );
      const sample = await page.evaluate(() => {
        const sulwe = document.querySelector("[data-sulwe-root]");
        const pill = document.querySelector("[data-tour-prompt='sulwe']");
        const nav = document.querySelector(".bottom-nav");
        if (!sulwe || !pill || !nav) return { missing: true };
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) };
        };
        const cta = [...document.querySelectorAll(".sticky-cta-bar")].find((el) => {
          const style = getComputedStyle(el);
          return style.display !== "none" && style.visibility !== "hidden" && el.getBoundingClientRect().height > 8;
        });
        const navTop = Math.round(nav.getBoundingClientRect().top);
        const anchorTop = cta ? Math.round(cta.getBoundingClientRect().top) : navTop;
        return {
          missing: false,
          sulwe: box(sulwe),
          pill: box(pill),
          navTop,
          anchorTop,
          yielded: document.documentElement.getAttribute("data-sulwe-yield") === "1",
        };
      });
      if (sample.missing) {
        fail(errors, `${label} ${path} scroll ${y} lost the dock`);
        break;
      }
      if (!seat) seat = sample;
      if (!sameSeat(sample.sulwe, seat.sulwe) || !sameSeat(sample.pill, seat.pill)) {
        fail(errors, `${label} ${path} scroll ${y} dock moved ${JSON.stringify({ sulwe: sample.sulwe, pill: sample.pill, home: seat.sulwe })}`);
        break;
      }
      const aboveNav = sample.sulwe.b <= sample.anchorTop - 4 && sample.sulwe.b <= sample.navTop - 4;
      const inBand = sample.sulwe.b >= sample.anchorTop - 36;
      const pillWithSulwe = sample.pill.r <= sample.sulwe.l + 16 && sample.pill.b > sample.sulwe.t && sample.pill.t < sample.sulwe.b;
      if (!aboveNav || !inBand || !pillWithSulwe) {
        fail(errors, `${label} ${path} scroll ${y} dock left the bottom band ${JSON.stringify(sample)}`);
        break;
      }
      if (sample.yielded) sawYield = true;
      else sawVisible = true;
    }
    console.log(label, path, "seat", seat && seat.sulwe.b, "yielded", sawYield, "visible", sawVisible);
    if (path === "/" && (!sawYield || !sawVisible)) {
      fail(errors, `${label} home did not show both a yielded and a visible dock`);
    }
  }
  await browser.close();
}

if (fixture.status === 0) {
  await hitPass(webkit, "webkit-390", 390, 844);
  await hitPass(chromium, "chromium-390", 390, 844);
  await hitPass(chromium, "chromium-1280", 1280, 800);
  await gridDockPass(webkit, "webkit-390", 390, 844);
  await gridDockPass(chromium, "chromium-390", 390, 844);
  await gridDockPass(chromium, "chromium-1280", 1280, 800);
  await gridDockPass(chromium, "chromium-1440", 1440, 900);
  await dockSeatPass(webkit, "webkit-390");
  await dockSeatPass(chromium, "chromium-390");
}

async function chunkLoadPass() {
  const browser = await webkit.launch();
  const context = await browser.newContext({
    ...iphone,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (msg) => {
    if (/ChunkLoadError|Failed to load chunk/i.test(msg.text())) problems.push(msg.text().slice(0, 180));
  });
  page.on("pageerror", (err) => problems.push(`${err.name}: ${err.message}`.slice(0, 180)));
  const response = await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(600);
  const first = await page.evaluate(() => ({
    broken: /Something went wrong|Rangach did not load|This page did not load/.test(document.body.innerText),
    h1: document.querySelector("h1")?.innerText?.slice(0, 80) || "",
  }));
  if (!response || response.status() >= 400) fail(errors, `webkit first load status ${response ? response.status() : "none"}`);
  if (first.broken) fail(errors, `webkit first load showed the error screen (${first.h1})`);
  if (problems.length) fail(errors, `webkit first load ${problems.join(" | ")}`);
  problems.length = 0;
  await page.goto(`${BASE}/listings`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(400);
  const second = await page.evaluate(() => /Something went wrong|Rangach did not load|This page did not load/.test(document.body.innerText));
  if (second) fail(errors, "webkit second load showed the error screen");
  if (problems.length) fail(errors, `webkit second load ${problems.join(" | ")}`);
  console.log("webkit fresh context", first.h1 || "(no heading)", "no ChunkLoadError");
  await browser.close();
}

await chunkLoadPass();

if (errors.length) {
  console.error(`\n${errors.length} layout check(s) failed`);
  process.exit(1);
}
console.log("layout guard passed");

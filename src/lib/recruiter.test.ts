import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import jsQR from "jsqr";
import sharp from "sharp";
import { agentPresetRange } from "@/lib/agent-code";
import { proxy } from "@/proxy";
import { recruiterQrPng, RECRUITER_QR_PNG_PX, RECRUITER_QR_PRINT_PX } from "@/lib/recruiter-qr";
import { RECRUITER_REDIRECT_STATUS, recruiterShortRedirect } from "@/lib/recruiter-redirect";
import { GET as shortLink } from "@/app/r/[code]/route";
import { GET as bareShortLink } from "@/app/r/route";
import {
  LIST_YOUR_SHOP_PATH,
  RECRUITER_COOKIE,
  RECRUITER_COOKIE_MAX_AGE,
  RECRUITER_SHORT_PREFIX,
  SEEDED_RECRUITER,
  addRecruiter,
  cleanRecruiterName,
  countReferredShops,
  editRecruiter,
  ensureSeedRecruiter,
  isRecruiterShortPath,
  normalizeRecruiterCode,
  openShopWithReferral,
  recruiterCodeForNewShop,
  recruiterCodeFromShortPath,
  recruiterCodeFromVisit,
  recruiterCodeToStore,
  recruiterCookieOptions,
  recruiterRefToRemember,
  recruiterShortHop,
  recruiterShortUrl,
  recruiterSignupUrl,
  referredShopStatus,
} from "@/lib/recruiter";

const IRENE_URL = "https://www.rangach.co.ke/list-your-shop?ref=irene";
const IRENE_SHORT = "https://www.rangach.co.ke/r/irene";

function active(code: string) {
  return async (wanted: string) => (wanted === code ? { code, active: true } : null);
}

test("recruiter codes are lowercase and match the length and character rules", () => {
  assert.equal(normalizeRecruiterCode("Irene"), "irene");
  assert.equal(normalizeRecruiterCode("  IRENE  "), "irene");
  assert.equal(normalizeRecruiterCode("ab"), "ab");
  assert.equal(normalizeRecruiterCode("a".repeat(32)), "a".repeat(32));
  assert.equal(normalizeRecruiterCode("lake-side"), "lake-side");
  assert.equal(normalizeRecruiterCode("a"), null);
  assert.equal(normalizeRecruiterCode("a".repeat(33)), null);
  assert.equal(normalizeRecruiterCode(""), null);
  assert.equal(normalizeRecruiterCode("   "), null);
  assert.equal(normalizeRecruiterCode("irene!"), null);
  assert.equal(normalizeRecruiterCode("ir ene"), null);
  assert.equal(normalizeRecruiterCode("irene<script>"), null);
  assert.equal(normalizeRecruiterCode(null), null);
  assert.equal(normalizeRecruiterCode(12), null);
  assert.equal(cleanRecruiterName("  Irene   Achieng "), "Irene Achieng");
  assert.equal(cleanRecruiterName("A"), null);
});

test("a list-your-shop visit stores the ref, and other pages do not", () => {
  const first = proxy(new NextRequest("https://www.rangach.co.ke/list-your-shop?ref=Irene"));
  const set = first.cookies.get(RECRUITER_COOKIE);
  assert.equal(set?.value, "irene");
  assert.equal(set?.httpOnly, true);
  assert.equal(set?.sameSite, "lax");
  assert.equal(set?.path, "/");
  assert.equal(set?.maxAge, RECRUITER_COOKIE_MAX_AGE);
  assert.equal(set?.secure, true);
  assert.equal(recruiterCookieOptions(false).secure, false);

  const again = proxy(
    new NextRequest("https://www.rangach.co.ke/list-your-shop?ref=irene", {
      headers: { cookie: `${RECRUITER_COOKIE}=irene` },
    }),
  );
  assert.equal(again.cookies.get(RECRUITER_COOKIE), undefined);

  const replaced = proxy(
    new NextRequest("http://localhost:3000/list-your-shop?ref=Amina", {
      headers: { cookie: `${RECRUITER_COOKIE}=irene` },
    }),
  );
  assert.equal(replaced.cookies.get(RECRUITER_COOKIE)?.value, "amina");
  assert.equal(replaced.cookies.get(RECRUITER_COOKIE)?.secure, false);

  const junk = proxy(
    new NextRequest("https://www.rangach.co.ke/list-your-shop?ref=no!", {
      headers: { cookie: `${RECRUITER_COOKIE}=irene` },
    }),
  );
  assert.equal(junk.cookies.get(RECRUITER_COOKIE), undefined);

  const business = proxy(new NextRequest("https://www.rangach.co.ke/business?ref=kisumu-qr"));
  assert.equal(business.cookies.get(RECRUITER_COOKIE), undefined);

  const elsewhere = proxy(new NextRequest("https://www.rangach.co.ke/list?ref=irene"));
  assert.equal(elsewhere.cookies.get(RECRUITER_COOKIE), undefined);

  const short = proxy(new NextRequest("https://www.rangach.co.ke/r/Irene"));
  const shortCookie = short.cookies.get(RECRUITER_COOKIE);
  assert.equal(shortCookie?.value, "irene");
  assert.equal(shortCookie?.httpOnly, true);
  assert.equal(shortCookie?.sameSite, "lax");
  assert.equal(shortCookie?.path, "/");
  assert.equal(shortCookie?.maxAge, RECRUITER_COOKIE_MAX_AGE);
  assert.equal(short.headers.get("location"), null);
  assert.notEqual(short.status, 401);
  assert.notEqual(short.status, 403);

  const shortAgain = proxy(
    new NextRequest("https://www.rangach.co.ke/r/irene", {
      headers: { cookie: `${RECRUITER_COOKIE}=irene` },
    }),
  );
  assert.equal(shortAgain.cookies.get(RECRUITER_COOKIE), undefined);

  const shortJunk = proxy(
    new NextRequest("https://www.rangach.co.ke/r/no!", {
      headers: { cookie: `${RECRUITER_COOKIE}=irene` },
    }),
  );
  assert.equal(shortJunk.cookies.get(RECRUITER_COOKIE), undefined);
  assert.equal(recruiterCodeFromShortPath("/r/Irene"), "irene");
  assert.equal(recruiterCodeFromShortPath("/r/no!"), null);
  assert.equal(recruiterCodeFromShortPath("/register"), null);
  assert.equal(isRecruiterShortPath("/r/irene"), true);
  assert.equal(isRecruiterShortPath("/register"), false);

  assert.equal(recruiterCodeToStore("irene", "irene"), null);
  assert.equal(recruiterCodeToStore("irene", "bad code"), null);
  assert.equal(recruiterCodeFromVisit("Irene", "amina"), "irene");
  assert.equal(recruiterCodeFromVisit("no!", "Amina"), "amina");
  assert.equal(recruiterCodeFromVisit("", null), "");
});

test("the hidden field and localStorage keep a valid code and drop junk", () => {
  assert.deepEqual(recruiterRefToRemember("Irene", null, ""), { value: "irene", write: "irene" });
  assert.deepEqual(recruiterRefToRemember("", "AMINA", ""), { value: "amina", write: null });
  assert.deepEqual(recruiterRefToRemember("no!", null, "Irene"), { value: "irene", write: "irene" });
  assert.deepEqual(recruiterRefToRemember("", "bad!", ""), { value: "", write: null });
});

test("an active recruiter code is saved on the new shop", async () => {
  const saved = await openShopWithReferral({
    form: "Irene",
    cookie: "amina",
    findRecruiter: active("irene"),
    createShop: async (data) => ({ id: "shop-1", ...data }),
  });
  assert.equal(saved.recruiterCode, "irene");

  const fromCookie = await recruiterCodeForNewShop({ form: "", cookie: "Irene" }, active("irene"));
  assert.equal(fromCookie, "irene");
  assert.equal(recruiterSignupUrl("https://www.rangach.co.ke/", "irene"), IRENE_URL);
  assert.equal(recruiterShortUrl("https://www.rangach.co.ke/", "irene"), IRENE_SHORT);
  assert.deepEqual(recruiterShortHop("Irene"), { code: "irene", path: "/list-your-shop?ref=irene" });
  assert.deepEqual(recruiterShortHop("no!"), { code: null, path: "/list-your-shop" });
  assert.equal(RECRUITER_SHORT_PREFIX, "/r");
});

test("an unknown or inactive code still opens the shop and stores nothing", async () => {
  const unknown = await openShopWithReferral({
    form: "nobody",
    cookie: "irene",
    findRecruiter: active("irene"),
    createShop: async (data) => ({ id: "shop-2", ...data }),
  });
  assert.equal(unknown.id, "shop-2");
  assert.equal(unknown.recruiterCode, null);

  const inactive = await openShopWithReferral({
    form: "",
    cookie: "irene",
    findRecruiter: async () => ({ code: "irene", active: false }),
    createShop: async (data) => ({ id: "shop-3", ...data }),
  });
  assert.equal(inactive.recruiterCode, null);

  const junk = await openShopWithReferral({
    form: "Irene!",
    cookie: "irene",
    findRecruiter: active("irene"),
    createShop: async (data) => ({ id: "shop-4", ...data }),
  });
  assert.equal(junk.recruiterCode, null);
});

test("a sign-up with no ref stores nothing and still creates the shop", async () => {
  const saved = await openShopWithReferral({
    form: "",
    cookie: null,
    findRecruiter: async () => {
      throw new Error("lookup should not run");
    },
    createShop: async (data) => ({ id: "shop-5", ...data }),
  });
  assert.equal(saved.id, "shop-5");
  assert.equal(saved.recruiterCode, null);
  assert.equal(referredShopStatus({ published: false, hidden: false }), "Draft");
  assert.equal(referredShopStatus({ published: true, hidden: false }), "Published");
  assert.equal(referredShopStatus({ published: true, hidden: true }), "Taken down");
});

test("starting a shop writes the resolved code onto the shop record", () => {
  const source = readFileSync(new URL("./actions/storefront.ts", import.meta.url), "utf8");
  assert.match(source, /recruiterCodeForNewShop/);
  assert.match(source, /published: false, recruiterCode/);
  const page = readFileSync(new URL("../app/list-your-shop/page.tsx", import.meta.url), "utf8");
  assert.match(page, /name="recruiterCode"|RecruiterRefField/);
  assert.match(page, /RegisterForm/);
  assert.doesNotMatch(page, /funeral|escrow/i);
  const admin = readFileSync(new URL("../app/admin/recruiters/page.tsx", import.meta.url), "utf8");
  assert.match(admin, /requireAdmin\("\/admin\/recruiters"\)/);
  assert.match(admin, /This week/);
  assert.match(admin, /Download PNG/);
  assert.match(admin, /recruiterShortUrl/);
  assert.match(admin, /CopyTextButton/);
  assert.doesNotMatch(admin, /funeral|escrow/i);
  const qrRoute = readFileSync(new URL("../app/admin/recruiters/[code]/qr/route.ts", import.meta.url), "utf8");
  assert.match(qrRoute, /recruiterShortUrl/);
  assert.doesNotMatch(qrRoute, /recruiterSignupUrl/);
  const hop = readFileSync(new URL("../app/r/[code]/route.ts", import.meta.url), "utf8");
  assert.match(hop, /recruiterShortRedirect/);
  assert.doesNotMatch(hop, /requireAdmin|requireUser/);
  assert.doesNotMatch(hop, /funeral|escrow/i);
  const print = readFileSync(new URL("../app/admin/recruiters/[code]/print/page.tsx", import.meta.url), "utf8");
  assert.match(print, /recruiterShortUrl/);
  assert.doesNotMatch(print, /funeral|escrow/i);
});

test("this week counts Nairobi Monday to Monday, and all time counts every shop", () => {
  const now = new Date("2026-11-18T12:00:00.000Z");
  const week = agentPresetRange("week", now);
  const inside = new Date(week.from.getTime() + 60 * 60 * 1000);
  const before = new Date(week.from.getTime() - 60 * 60 * 1000);
  const counts = countReferredShops([inside, before, inside], now);
  assert.equal(counts.thisWeek, 2);
  assert.equal(counts.allTime, 3);
  assert.equal(countReferredShops([], now).allTime, 0);
});

test("admins can add, edit, and deactivate a recruiter, and Irene is only inserted when missing", async () => {
  type Row = { id: string; code: string; name: string; active: boolean };
  const rows = new Map<string, Row>();
  const audits: string[] = [];
  const db = {
    findByCode: async (code: string) => {
      const row = [...rows.values()].find((item) => item.code === code);
      return row ? { id: row.id } : null;
    },
    create: async (data: { code: string; name: string; active: true }) => {
      const row = { id: `id-${rows.size + 1}`, ...data };
      rows.set(row.id, row);
      return { id: row.id, code: row.code };
    },
    find: async (id: string) => rows.get(id) ?? null,
    update: async (id: string, data: { name: string; active: boolean }) => {
      const row = rows.get(id);
      if (!row) throw new Error("missing");
      rows.set(id, { ...row, ...data });
    },
    audit: async (entry: { action: string }) => {
      audits.push(entry.action);
    },
  };

  const added = await addRecruiter({
    code: "Irene",
    name: "Irene",
    findByCode: db.findByCode,
    create: db.create,
    audit: db.audit,
  });
  assert.equal(added.ok && added.code, "irene");
  const again = await addRecruiter({
    code: "irene",
    name: "Irene",
    findByCode: db.findByCode,
    create: db.create,
    audit: db.audit,
  });
  assert.deepEqual(again, { ok: false, code: "taken" });
  const bad = await addRecruiter({ code: "x", name: "X", findByCode: db.findByCode, create: db.create, audit: db.audit });
  assert.deepEqual(bad, { ok: false, code: "format" });

  const id = added.ok ? added.id : "";
  const off = await editRecruiter({
    id,
    name: "Irene A.",
    active: "no",
    find: db.find,
    update: db.update,
    audit: db.audit,
  });
  assert.deepEqual(off, { ok: true, changed: true });
  assert.equal(rows.get(id)?.active, false);
  assert.equal(rows.get(id)?.name, "Irene A.");
  assert.deepEqual(audits, ["recruiter.add", "recruiter.update"]);

  const seedDb = {
    recruiter: {
      findUnique: async () => ({ id: "already" }),
      create: async () => {
        throw new Error("should not create");
      },
    },
  };
  assert.deepEqual(await ensureSeedRecruiter(seedDb), { created: false });
  let inserted = 0;
  const emptyDb = {
    recruiter: {
      findUnique: async () => null,
      create: async (args: { data: { code: string; name: string; active: boolean } }) => {
        inserted += 1;
        assert.equal(args.data.code, SEEDED_RECRUITER.code);
        assert.equal(args.data.name, SEEDED_RECRUITER.name);
        assert.equal(args.data.active, true);
      },
    },
  };
  assert.deepEqual(await ensureSeedRecruiter(emptyDb), { created: true });
  assert.equal(inserted, 1);
});

function redirectTarget(response: Response) {
  const location = response.headers.get("location");
  assert.ok(location);
  return new URL(location);
}

test("/r/irene redirects to the shop form, sets the cookie, and normalises case", async () => {
  const response = await shortLink(new NextRequest("https://www.rangach.co.ke/r/Irene"), {
    params: Promise.resolve({ code: "Irene" }),
  });
  assert.equal(response.status, RECRUITER_REDIRECT_STATUS);
  assert.equal(response.status, 307);
  const target = redirectTarget(response);
  assert.equal(target.origin, "https://www.rangach.co.ke");
  assert.equal(target.pathname, LIST_YOUR_SHOP_PATH);
  assert.equal(target.searchParams.get("ref"), "irene");
  const cookie = response.cookies.get(RECRUITER_COOKIE);
  assert.equal(cookie?.value, "irene");
  assert.equal(cookie?.httpOnly, true);
  assert.equal(cookie?.sameSite, "lax");
  assert.equal(cookie?.path, "/");
  assert.equal(cookie?.maxAge, RECRUITER_COOKIE_MAX_AGE);
  assert.equal(cookie?.secure, true);
  const cache = response.headers.get("cache-control") ?? "";
  assert.match(cache, /no-store/);
  assert.equal(/immutable|s-maxage|max-age=31536000/.test(cache), false);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);

  const upper = recruiterShortRedirect(new NextRequest("http://localhost:3000/r/IRENE"), "IRENE");
  assert.equal(redirectTarget(upper).searchParams.get("ref"), "irene");
  assert.equal(upper.cookies.get(RECRUITER_COOKIE)?.value, "irene");
  assert.equal(upper.cookies.get(RECRUITER_COOKIE)?.secure, false);

  const same = await shortLink(
    new NextRequest("https://www.rangach.co.ke/r/irene", { headers: { cookie: `${RECRUITER_COOKIE}=irene` } }),
    { params: Promise.resolve({ code: "irene" }) },
  );
  assert.equal(redirectTarget(same).searchParams.get("ref"), "irene");
  assert.equal(same.cookies.get(RECRUITER_COOKIE), undefined);

  const unknown = await shortLink(new NextRequest("https://www.rangach.co.ke/r/nobody"), {
    params: Promise.resolve({ code: "nobody" }),
  });
  assert.equal(unknown.status, 307);
  assert.equal(redirectTarget(unknown).pathname, LIST_YOUR_SHOP_PATH);
  assert.equal(redirectTarget(unknown).searchParams.get("ref"), "nobody");
  assert.equal(unknown.cookies.get(RECRUITER_COOKIE)?.value, "nobody");
});

test("an invalid short code still opens the shop form and leaves a stored code alone", async () => {
  for (const code of ["no!", "a", "irene<script>", "ir ene"]) {
    const response = await shortLink(new NextRequest(`https://www.rangach.co.ke/r/${encodeURIComponent(code)}`), {
      params: Promise.resolve({ code }),
    });
    assert.equal(response.status, 307, code);
    const target = redirectTarget(response);
    assert.equal(target.pathname, LIST_YOUR_SHOP_PATH, code);
    assert.equal(target.search, "", code);
    assert.equal(response.cookies.get(RECRUITER_COOKIE), undefined, code);
    assert.notEqual(response.status, 404, code);
  }

  const kept = recruiterShortRedirect(
    new NextRequest("https://www.rangach.co.ke/r/no!", { headers: { cookie: `${RECRUITER_COOKIE}=irene` } }),
    "no!",
  );
  assert.equal(kept.status, 307);
  assert.equal(redirectTarget(kept).search, "");
  assert.equal(kept.cookies.get(RECRUITER_COOKIE), undefined);

  const bare = bareShortLink(new NextRequest("https://www.rangach.co.ke/r"));
  assert.equal(bare.status, 307);
  assert.equal(redirectTarget(bare).pathname, LIST_YOUR_SHOP_PATH);
  assert.equal(redirectTarget(bare).search, "");
  assert.match(bare.headers.get("x-robots-tag") ?? "", /noindex/);
});

test("the recruiter QR png is large enough and opens the irene link", async () => {
  const png = await recruiterQrPng(IRENE_SHORT, RECRUITER_QR_PNG_PX);
  const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.ok(raw.info.width >= RECRUITER_QR_PNG_PX);
  assert.ok(raw.info.height >= RECRUITER_QR_PNG_PX);
  assert.equal(jsQR(new Uint8ClampedArray(raw.data), raw.info.width, raw.info.height)?.data, IRENE_SHORT);

  const printed = await recruiterQrPng(IRENE_SHORT, RECRUITER_QR_PRINT_PX);
  const printMeta = await sharp(printed).metadata();
  assert.ok((printMeta.width ?? 0) >= RECRUITER_QR_PRINT_PX);

  const previous = readFileSync(new URL("../../docs/pr-recruiters/irene-qr.png", import.meta.url));
  const previousRaw = await sharp(previous).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(previousRaw.data), previousRaw.info.width, previousRaw.info.height)?.data, IRENE_URL);

  const committed = readFileSync(new URL("../../docs/pr-recruiter-short-links/irene-qr.png", import.meta.url));
  const committedRaw = await sharp(committed).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(jsQR(new Uint8ClampedArray(committedRaw.data), committedRaw.info.width, committedRaw.info.height)?.data, IRENE_SHORT);
  assert.equal(LIST_YOUR_SHOP_PATH, "/list-your-shop");
});

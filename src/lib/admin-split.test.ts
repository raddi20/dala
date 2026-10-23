import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { ADMIN_SECTIONS, activeAdminHref, adminTiles } from "@/lib/admin-sections";
import { deletedListingNote } from "@/lib/report-keep";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const NEW_PAGES = ["reports", "reviews", "shop-checks", "listings", "people", "field-agents", "mail", "activity"];

test("every admin section links to a page that exists", () => {
  for (const section of ADMIN_SECTIONS) {
    assert.ok(existsSync(new URL(`../app${section.href}/page.tsx`, import.meta.url)), section.href);
  }
});

test("the dashboard and each new admin page require an admin before reading data", () => {
  const dash = read("src/app/admin/page.tsx");
  const dashBody = dash.slice(dash.indexOf("export default"));
  assert.match(dashBody, /await requireAdmin\(\)/);
  assert.ok(dashBody.indexOf("requireAdmin") < dashBody.indexOf("prisma."));
  for (const name of NEW_PAGES) {
    const body = read(`src/app/admin/${name}/page.tsx`);
    const fn = body.slice(body.indexOf("export default"));
    assert.match(fn, new RegExp(`await requireAdmin\\("/admin/${name}"\\)`), name);
    const firstData = fn.search(/prisma\.|<Admin/);
    if (firstData >= 0) assert.ok(fn.indexOf("requireAdmin") < firstData, name);
  }
});

test("dashboard badges are red for open reports, pending reviews, and pending shop checks", () => {
  const tiles = adminTiles({ openReports: 2, pendingReviews: 1, pendingShopChecks: 4, riskyListings: 3 }, { ordersOn: false });
  const by = new Map(tiles.map((tile) => [tile.href, tile]));
  assert.deepEqual([by.get("/admin/reports")?.badge, by.get("/admin/reports")?.tone], [2, "red"]);
  assert.deepEqual([by.get("/admin/reviews")?.badge, by.get("/admin/reviews")?.tone], [1, "red"]);
  assert.deepEqual([by.get("/admin/shop-checks")?.badge, by.get("/admin/shop-checks")?.tone], [4, "red"]);
  assert.equal(by.get("/admin/listings")?.tone, "amber");
  assert.equal(by.has("/admin/orders"), false);
  assert.equal(adminTiles({}, { ordersOn: true }).find((tile) => tile.href === "/admin/reports")?.tone, "none");
  assert.ok(adminTiles({}, { ordersOn: true }).some((tile) => tile.href === "/admin/orders"));
});

test("the dashboard counts what needs action", () => {
  const dash = read("src/app/admin/page.tsx");
  assert.match(dash, /prisma\.report\.count\(\{ where: \{ status: "open" \} \}\)/);
  assert.match(dash, /prisma\.shopReview\.count\(\{ where: \{ status: "pending" \} \}\)/);
  assert.match(dash, /phoneVerified: false, locationVerified: false, businessVerified: false/);
});

test("every moderation action is still wired to a form on an admin page", () => {
  const wiring: Record<string, string[]> = {
    reports: ["resolveReport"],
    reviews: ["setReviewHidden"],
    "shop-checks": ["setShopHidden", "setOfferingHidden", "setServesDiaspora", "setShopBadge"],
    listings: ["setListingHidden", "setListingVerified", "setListingFeatured"],
    people: ["setUserSuspended", "setVerifiedPro"],
  };
  for (const [page, actions] of Object.entries(wiring)) {
    const source = read(`src/app/admin/${page}/page.tsx`);
    for (const action of actions) {
      assert.match(source, new RegExp(`import \\{[^}]*\\b${action}\\b[^}]*\\} from "@/lib/actions/admin"`), action);
      assert.match(source, new RegExp(`action=\\{${action}\\}`), action);
    }
  }
  const reports = read("src/app/admin/reports/page.tsx");
  assert.match(reports, /Hide listing and close/);
  assert.match(reports, />Dismiss</);
  assert.match(read("src/app/admin/reviews/page.tsx"), /<AdminShopReviews \/>/);
  assert.match(read("src/components/admin-shop-reviews.tsx"), /action=\{setShopReviewStatus\}/);
  assert.match(read("src/app/admin/shop-checks/page.tsx"), /<AdminVideoQueue notice=\{videoNotice\} \/>/);
  assert.match(read("src/app/admin/listings/page.tsx"), /<AdminOccasions \/>/);
  assert.match(read("src/app/admin/field-agents/page.tsx"), /<AgentCountTable/);
  assert.match(read("src/app/admin/mail/page.tsx"), /<AdminMailTest \/>/);
  assert.match(read("src/app/admin/activity/page.tsx"), /adminAuditLog\.findMany/);
});

test("actions that return to a section land on its new page", () => {
  assert.match(read("src/lib/actions/video.ts"), /\/admin\/shop-checks\?videoNotice=/);
  assert.match(read("src/lib/actions/occasions.ts"), /redirect\("\/admin\/listings#occasions"\)/);
  const agents = read("src/components/admin-agent-counts.tsx");
  assert.equal(agents.includes("/admin#"), false);
  assert.match(agents, /action="\/admin\/field-agents"/);
});

test("the admin nav is shared by every admin page and marks the current section", () => {
  assert.match(read("src/app/admin/layout.tsx"), /<AdminNav/);
  assert.equal(activeAdminHref("/admin"), "/admin");
  assert.equal(activeAdminHref("/admin/reports"), "/admin/reports");
  assert.equal(activeAdminHref("/admin/ai/flags"), "/admin/ai");
  assert.equal(activeAdminHref("/admin/send-home"), "/admin/send-home");
});

test("deleting a listing keeps its reports for the admin queue", () => {
  assert.equal(deletedListingNote("Fresh tilapia", ""), '[Listing deleted by its owner: "Fresh tilapia"]');
  assert.equal(deletedListingNote("Fundi in Kisumu", "Fake number"), '[Listing deleted by its owner: "Fundi in Kisumu"]\nFake number');
  const body = read("src/lib/actions/listings.ts");
  const fn = body.slice(body.indexOf("export async function deleteListing"));
  assert.ok(fn.indexOf("listingId: null") >= 0);
  assert.ok(fn.indexOf("listingId: null") < fn.indexOf("tx.listing.delete"));
});

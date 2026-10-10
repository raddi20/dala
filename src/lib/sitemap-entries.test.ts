import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIES, categoryHref } from "@/lib/categories";
import { OG_IMAGE, absoluteUrl, buildShareMetadata, clipText, listingPreviewImage, privateMetadata, publicImageUrl, shopPreviewImage } from "@/lib/share-metadata";
import { listingOgModel, shopOgModel } from "@/lib/og-model";
import { PRIVATE_PREFIXES, buildRobots, buildSitemap, isPrivatePath, staticPublicPaths } from "@/lib/sitemap-entries";

const origin = "https://www.rangach.co.ke";

test("sitemap lists public pages and skips admin, account, auth, and api", () => {
  const when = new Date("2026-10-01T00:00:00.000Z");
  const pages = buildSitemap({
    origin,
    shops: [
      { slug: "mama-atieno", updatedAt: when },
      { slug: "", updatedAt: when },
    ],
    listings: [{ id: "list_1", updatedAt: when }],
    people: [{ id: "user_1", updatedAt: when }],
    occasions: [
      { slug: "weddings-dowry", updatedAt: when },
      { slug: "", updatedAt: when },
    ],
  });
  const urls = pages.map((page) => page.url);
  assert.ok(urls.includes(`${origin}/`));
  assert.ok(urls.includes(`${origin}/categories`));
  assert.ok(urls.includes(`${origin}/occasions`));
  assert.ok(urls.includes(`${origin}/occasions/weddings-dowry`));
  assert.ok(urls.includes(`${origin}/pricing`));
  assert.ok(urls.includes(`${origin}/listings`));
  assert.ok(urls.includes(`${origin}/b/mama-atieno`));
  assert.ok(urls.includes(`${origin}/listings/list_1`));
  assert.ok(urls.includes(`${origin}/people/user_1`));
  for (const category of CATEGORIES) {
    assert.ok(urls.includes(absoluteUrl(origin, categoryHref(category))), category);
  }
  assert.ok(urls.includes(`${origin}/listings?region=homeland`));
  assert.ok(urls.includes(`${origin}/listings?region=diaspora`));
  assert.equal(urls.some((url) => url.includes("city=")), false);
  for (const url of urls) {
    const path = new URL(url).pathname;
    assert.equal(isPrivatePath(path), false, url);
    assert.equal(path.startsWith("/upgrade"), false);
  }
  assert.equal(urls.some((url) => url.includes("/admin")), false);
  assert.equal(urls.some((url) => url.includes("/account")), false);
  assert.equal(urls.some((url) => url.includes("/api")), false);
  assert.equal(urls.some((url) => url.includes("/login")), false);
  assert.equal(urls.filter((url) => url.endsWith("/b/mama-atieno")).length, 1);
});

test("static paths include pricing and every category, and private prefixes stay out", () => {
  const paths = staticPublicPaths().map((item) => item.path);
  assert.ok(paths.includes("/pricing"));
  assert.ok(paths.includes("/occasions"));
  assert.equal(paths.filter((path) => isPrivatePath(path)).length, 0);
  assert.deepEqual(PRIVATE_PREFIXES, [
    "/admin",
    "/account",
    "/api",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ]);
});

test("robots allows the public site, blocks private prefixes, and points at the sitemap", () => {
  const robots = buildRobots(origin);
  assert.equal(robots.sitemap, `${origin}/sitemap.xml`);
  const rules = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
  assert.ok(rules);
  assert.equal(rules.userAgent, "*");
  assert.deepEqual(rules.allow, "/");
  assert.deepEqual(rules.disallow, [
    "/admin",
    "/account",
    "/api",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ]);
});

test("share metadata uses an absolute URL, card size, and twitter large image", () => {
  const meta = buildShareMetadata({
    origin,
    path: "/b/mama-atieno",
    title: "Atieno",
    description: "Luo food in Kilimani.",
    image: "/b/mama-atieno/opengraph-image",
    imageAlt: "Atieno",
  });
  const image = meta.openGraph?.images;
  const first = Array.isArray(image) ? image[0] : image;
  assert.equal(meta.alternates?.canonical, `${origin}/b/mama-atieno`);
  assert.equal(meta.openGraph?.url, `${origin}/b/mama-atieno`);
  assert.ok(first && typeof first === "object" && "width" in first);
  const descriptor = first as { url: string; width: number; height: number; type?: string };
  assert.equal(String(descriptor.url), `${origin}/b/mama-atieno/opengraph-image`);
  assert.equal(descriptor.width, OG_IMAGE.width);
  assert.equal(descriptor.height, OG_IMAGE.height);
  assert.equal(descriptor.type, "image/png");
  const twitter = meta.twitter as { card?: string } | null | undefined;
  assert.equal(twitter?.card, "summary_large_image");
  assert.equal(OG_IMAGE.width, 1200);
  assert.equal(OG_IMAGE.height, 630);
});

test("a public photo is the preview, and hidden or unpublished content is omitted", () => {
  const photo = "https://images.unsplash.com/photo-1?auto=format&w=1200";
  const shop = shopPreviewImage({
    origin,
    slug: "okello-and-co",
    published: true,
    verifiedPro: true,
    bannerUrl: photo,
    avatarUrl: "",
  });
  assert.equal(shop?.generated, false);
  assert.equal(shop?.url, photo);
  const plain = shopPreviewImage({
    origin,
    slug: "mama-atieno",
    published: true,
    verifiedPro: false,
    bannerUrl: photo,
    avatarUrl: "",
  });
  assert.equal(plain?.generated, true);
  assert.equal(plain?.url, `${origin}/b/mama-atieno/opengraph-image`);
  assert.equal(
    shopPreviewImage({
      origin,
      slug: "draft",
      published: false,
      verifiedPro: true,
      bannerUrl: photo,
      avatarUrl: "https://cdn.example/logo.jpg",
    }),
    null,
  );
  const listing = listingPreviewImage({ origin, id: "abc", hidden: false, photoUrl: photo });
  assert.equal(listing?.url, photo);
  assert.equal(listingPreviewImage({ origin, id: "abc", hidden: true, photoUrl: photo }), null);

  const hidden = privateMetadata("Listing");
  assert.equal(hidden.robots && typeof hidden.robots === "object" && "index" in hidden.robots ? hidden.robots.index : null, false);
  assert.equal(hidden.description, undefined);
  assert.equal(hidden.openGraph, undefined);
  assert.equal(JSON.stringify(hidden).includes(photo), false);
});

test("shop and listing cards drop private titles and unsafe image URLs", () => {
  const secret = shopOgModel({
    brand: "Rangach",
    published: false,
    name: "Secret Shop",
    city: "Nairobi",
    category: "Food & restaurants",
    coverUrl: "https://cdn.example/cover.jpg",
    logoUrl: "https://cdn.example/logo.jpg",
    verifiedPro: true,
  });
  assert.equal(secret.title, "Rangach");
  assert.equal(secret.photoUrl, "");
  assert.equal(JSON.stringify(secret).includes("Secret Shop"), false);

  const shown = shopOgModel({
    brand: "Rangach",
    published: true,
    name: "David Okello",
    city: "London",
    category: "Professional services",
    coverUrl: "https://cdn.example/cover.jpg",
    logoUrl: "https://cdn.example/logo.jpg",
    verifiedPro: true,
  });
  assert.equal(shown.title, "David Okello");
  assert.equal(shown.photoUrl, "https://cdn.example/cover.jpg");

  const logoOnly = shopOgModel({
    brand: "Rangach",
    published: true,
    name: "Atieno",
    city: "Nairobi",
    category: "",
    coverUrl: "https://cdn.example/cover.jpg",
    logoUrl: "https://cdn.example/logo.jpg",
    verifiedPro: false,
  });
  assert.equal(logoOnly.photoUrl, "https://cdn.example/logo.jpg");

  const listing = listingOgModel({
    brand: "Rangach",
    hidden: true,
    title: "Hidden plot",
    city: "London",
    category: "Land & plots",
    photoUrl: "https://cdn.example/plot.jpg",
  });
  assert.equal(listing.title, "Rangach");
  assert.equal(JSON.stringify(listing).includes("Hidden plot"), false);

  assert.equal(publicImageUrl("http://cdn.example/a.jpg"), "");
  assert.equal(publicImageUrl("https://127.0.0.1/a.jpg"), "");
  assert.equal(publicImageUrl("https://user:pass@cdn.example/a.jpg"), "");
  assert.equal(publicImageUrl("/hero.svg", origin), `${origin}/hero.svg`);
  assert.equal(clipText("a".repeat(200)).endsWith("…"), true);
});

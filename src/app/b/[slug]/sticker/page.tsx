import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StickerSheet } from "@/components/sticker-sheet";
import { btnSecondary } from "@/components/ui";
import { publicOrigin } from "@/lib/payments/origin";
import { loadStickerShop } from "@/lib/sticker-shop";
import { parseStickerSize, stickerTargetUrl, type StickerSize } from "@/lib/sticker";
import { one } from "@/lib/utils";
import "./sticker.css";

export const metadata: Metadata = {
  title: "Print sticker",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function sizeHref(slug: string, size: StickerSize) {
  return size === "square" ? `/b/${slug}/sticker?size=square` : `/b/${slug}/sticker`;
}

function fileHref(slug: string, size: StickerSize, format: "svg" | "png") {
  const params = new URLSearchParams({ size, format, download: "1" });
  return `/b/${slug}/sticker/file?${params.toString()}`;
}

export default async function StickerPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const shop = await loadStickerShop(slug);
  if (!shop) notFound();
  const size = parseStickerSize(one((await searchParams).size));
  const url = stickerTargetUrl(await publicOrigin(), shop.slug);
  const linkClass = `${btnSecondary} min-h-11 px-4`;

  return (
    <div className="sticker-page">
      <nav className="sticker-toolbar" aria-label="Sticker size">
        <Link href={sizeHref(shop.slug, "a6")} aria-current={size === "a6" ? "page" : undefined} className={linkClass}>
          A6
        </Link>
        <Link
          href={sizeHref(shop.slug, "square")}
          aria-current={size === "square" ? "page" : undefined}
          className={linkClass}
        >
          10 cm square
        </Link>
        <a className={linkClass} href={fileHref(shop.slug, size, "svg")}>
          Download SVG
        </a>
        <a className={linkClass} href={fileHref(shop.slug, size, "png")}>
          Download PNG
        </a>
      </nav>
      {shop.published ? (
        <p className="sticker-note">Print this page. The toolbar stays off the paper.</p>
      ) : (
        <p className="sticker-note">This shop is still a draft. The code opens the shop after you publish it.</p>
      )}
      <StickerSheet name={shop.name} url={url} size={size} />
    </div>
  );
}

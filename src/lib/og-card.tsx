import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { OgCardModel } from "@/lib/og-model";
import { OG_IMAGE } from "@/lib/share-metadata";

function titleSize(title: string) {
  if (title.length > 48) return 46;
  if (title.length > 28) return 56;
  return 68;
}

function GateMark() {
  return (
    <svg width="42" height="42" viewBox="0 0 32 32" fill="none">
      <path d="M9.5 26V13.2" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M22.5 26V13.2" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.5 13.4c0-4.6 13-4.6 13 0" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.5 16.4h13" stroke="#c8881a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlayMark() {
  return (
    <div
      style={{
        position: "absolute",
        left: 200,
        top: 255,
        width: 120,
        height: 120,
        borderRadius: 60,
        background: "#1a2436",
        color: "#fbf1dc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 52,
        paddingLeft: 8,
      }}
    >
      ▶
    </div>
  );
}

export function OgCard({ brand, kicker, title, subtitle, photoUrl, showPlay }: OgCardModel) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#1a2436",
        color: "#fbf1dc",
        fontFamily: "sans-serif",
      }}
    >
      {photoUrl ? (
        <div style={{ width: 520, height: OG_IMAGE.height, display: "flex", position: "relative", overflow: "hidden" }}>
          {/* next/og draws this img; it is the shop cover, logo, listing photo, or video poster. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt="" width={520} height={OG_IMAGE.height} style={{ width: 520, height: OG_IMAGE.height, objectFit: "cover" }} />
          {showPlay ? <PlayMark /> : null}
        </div>
      ) : (
        <div style={{ width: 18, height: "100%", background: "#c8881a", display: "flex" }} />
      )}
      <div
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 56px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#2a364c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GateMark />
          </div>
          <div style={{ display: "flex", fontSize: 28, letterSpacing: "0.08em", color: "#c8881a" }}>
            {brand.toUpperCase()}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {kicker ? (
            <div style={{ display: "flex", fontSize: 24, color: "#c8881a", marginBottom: 16 }}>{kicker}</div>
          ) : null}
          <div style={{ display: "flex", fontSize: titleSize(title), lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            {title}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#f7f3ec" }}>{subtitle}</div>
      </div>
    </div>
  );
}

function inlinePublicFile(urlPath: string) {
  if (!urlPath.startsWith("/mock/")) return "";
  const relative = urlPath.replace(/^\/+/, "");
  if (relative.includes("..")) return "";
  try {
    const bytes = readFileSync(join(process.cwd(), "public", relative));
    if (bytes.byteLength < 32 || bytes.byteLength > 4_500_000) return "";
    const type = relative.endsWith(".png") ? "image/png" : "image/jpeg";
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return "";
  }
}

async function inlineImage(url: string) {
  if (url.startsWith("/")) return inlinePublicFile(url);
  try {
    const response = await fetch(url, {
      headers: { Accept: "image/*", "User-Agent": "RangachLinkPreview/1.0" },
      signal: AbortSignal.timeout(5000),
      redirect: "follow",
    });
    if (!response.ok) return "";
    const type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim() ?? "";
    if (!type.startsWith("image/")) return "";
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 32 || bytes.byteLength > 4_500_000) return "";
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch {
    return "";
  }
}

export async function renderOgCard(model: OgCardModel) {
  const photo = model.photoUrl ? await inlineImage(model.photoUrl) : "";
  const draw = (photoUrl: string) =>
    new ImageResponse(<OgCard {...model} photoUrl={photoUrl} />, {
      width: OG_IMAGE.width,
      height: OG_IMAGE.height,
    });
  if (!photo) return draw("");
  try {
    return draw(photo);
  } catch {
    return draw("");
  }
}

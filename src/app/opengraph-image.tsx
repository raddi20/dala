import { ImageResponse } from "next/og";
import { APP_TAGLINE, AUDIENCE_LINE, appName } from "@/lib/brand";

export const alt = "Rangach, the gateway to the Luo home";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const name = appName();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#1a2436",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#2a364c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="64" height="64" viewBox="0 0 32 32" fill="none">
              <path d="M9.5 26V13.2" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M22.5 26V13.2" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M9.5 13.4c0-4.6 13-4.6 13 0" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M9.5 16.4h13" stroke="#c8881a" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 92, color: "#fbf1dc", letterSpacing: "-0.03em" }}>{name}</div>
        </div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 36, color: "#c8881a" }}>{APP_TAGLINE}</div>
        <div style={{ display: "flex", marginTop: 16, fontSize: 28, color: "#f7f3ec" }}>
          Luo shops and classifieds in {AUDIENCE_LINE}. Chat stays on WhatsApp.
        </div>
      </div>
    ),
    size,
  );
}

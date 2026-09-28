import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1a2436",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="none">
          <path d="M9.5 26V13.2" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M22.5 26V13.2" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9.5 13.4c0-4.6 13-4.6 13 0" stroke="#fbf1dc" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M9.5 16.4h13" stroke="#c8881a" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}

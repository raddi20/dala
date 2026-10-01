"use client";

import { useState } from "react";
import { PLAY_DATA_LABEL } from "@/lib/video/constants";

type PlayerModule = typeof import("@mux/mux-player-react").default;

type Props = {
  playbackId: string;
  posterUrl: string;
  caption: string;
  mock: boolean;
  tokens?: { playback: string; thumbnail: string };
};

export function ShopVideoPoster({ playbackId, posterUrl, caption, mock, tokens }: Props) {
  const [Player, setPlayer] = useState<PlayerModule | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState("");
  const label = caption.trim() || "Shop video";
  const buttonLabel = caption.trim() ? `Play video: ${caption.trim()}. About 5 MB.` : "Play shop video. About 5 MB.";

  async function play() {
    setOpen(true);
    setFailed("");
    if (mock || Player) return;
    try {
      const loaded = await import("@mux/mux-player-react");
      setPlayer(() => loaded.default);
    } catch {
      setFailed("The player could not load. Check your connection and try again.");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => void play()}
        className="group relative block w-full overflow-hidden rounded-2xl bg-navy text-left"
        aria-label={buttonLabel}
      >
        {posterUrl ? (
          // Mux thumbnails and the local mock poster are plain img sources.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={posterUrl} alt={label} className="aspect-video w-full object-cover" />
        ) : (
          <span className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-navy to-lake-dark" />
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-navy/85 px-4 py-2 text-sm font-semibold text-white shadow-md">
            <span aria-hidden="true">▶</span>
            Play
            <span className="font-medium text-white/80">{PLAY_DATA_LABEL}</span>
          </span>
        </span>
      </button>
    );
  }

  if (failed) {
    return (
      <p className="rounded-xl border border-danger/25 bg-red-50 px-3.5 py-2.5 text-sm text-danger" role="alert">
        {failed}
      </p>
    );
  }

  if (mock) {
    return (
      <video
        className="aspect-video w-full rounded-2xl bg-navy"
        controls
        playsInline
        preload="none"
        poster={posterUrl || undefined}
        aria-label={label}
      >
        <source src="/mock/shop-video.mp4" type="video/mp4" />
      </video>
    );
  }

  if (!Player || !playbackId) {
    return <p className="text-sm text-ink/70">Loading the player…</p>;
  }

  return (
    <Player
      playbackId={playbackId}
      poster={posterUrl || undefined}
      streamType="on-demand"
      autoPlay={false}
      preload="none"
      maxResolution="720p"
      maxAutoResolution="720p"
      initialBandwidthEstimateKbps={400}
      extraSourceParams={{ max_resolution: "720p" }}
      _hlsConfig={{ startLevel: 0, capLevelToPlayerSize: true }}
      tokens={tokens}
      metadataVideoTitle={label}
      title={label}
      accentColor="#1a2436"
      thumbnailTime={1}
      style={{ width: "100%", aspectRatio: "16 / 9" }}
    />
  );
}

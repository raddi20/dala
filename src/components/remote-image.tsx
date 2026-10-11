"use client";

import { useState, type ReactNode } from "react";

export function RemoteImage({
  src,
  alt,
  className,
  children,
  srcSet,
  sizes,
  width,
  height,
  loading,
  decoding,
  fetchPriority,
}: {
  src: string;
  alt: string;
  className?: string;
  children: ReactNode;
  srcSet?: string;
  sizes?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  decoding?: "async" | "auto" | "sync";
  fetchPriority?: "high" | "low" | "auto";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return children;
  return (
    // User-supplied URLs are arbitrary; next/image would need a remote allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={width}
      height={height}
      alt={alt}
      className={className}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      onError={() => setFailed(true)}
    />
  );
}

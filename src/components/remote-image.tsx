"use client";

import { useState, type ReactNode } from "react";

export function RemoteImage({
  src,
  alt,
  className,
  children,
}: {
  src: string;
  alt: string;
  className?: string;
  children: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return children;
  return (
    // User-supplied URLs are arbitrary; next/image would need a remote allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}

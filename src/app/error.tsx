"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/status-page";
import { reportError } from "@/lib/report-error";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <StatusPage
      title="Something went wrong"
      body="This page did not load. Try again, or go back to the listings. If it keeps happening, contact us and mention the reference."
      digest={error.digest}
      onRetry={reset}
    />
  );
}

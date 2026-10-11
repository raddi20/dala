"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/status-page";
import { reportError } from "@/lib/report-error";
import "./globals.css";

export default function GlobalError({
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
    <html lang="en">
      <body
        className="min-h-full bg-[#f7f3ec] text-[#141a24] antialiased"
        style={{ fontFamily: 'Figtree, "Segoe UI", ui-sans-serif, system-ui, sans-serif' }}
      >
        <main id="main" className="flex min-h-full flex-col">
          <StatusPage
            title="Something went wrong"
            body="Rangach did not load. Try again, or go back to the listings. If it keeps happening, contact us and mention the reference."
            digest={error.digest}
            onRetry={reset}
          />
        </main>
      </body>
    </html>
  );
}

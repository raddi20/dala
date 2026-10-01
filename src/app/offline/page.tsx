import type { Metadata } from "next";
import { OfflineRetry } from "@/components/offline-retry";
import { Wordmark } from "@/components/wordmark";
import { APP_TAGLINE, appName } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  const name = appName();
  return (
    <div id="offline-page" className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <Wordmark size="lg" />
      <h1 className="mt-6 font-serif text-3xl text-navy">You are offline</h1>
      <p className="mt-3 max-w-sm text-sm text-ink/70">
        {APP_TAGLINE} Reconnect to see the latest listings and prices on {name}, then try again.
      </p>
      <OfflineRetry />
    </div>
  );
}

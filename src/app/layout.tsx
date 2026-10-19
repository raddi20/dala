import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { BackBar } from "@/components/back-bar";
import { Footer } from "@/components/footer";
import { GuidedTour } from "@/components/guided-tour";
import { Sulwe } from "@/components/sulwe";
import { Header } from "@/components/header";
import { TourReplay } from "@/components/tour-replay";
import { InstallPrompt } from "@/components/install-prompt";
import { PwaRegister } from "@/components/pwa-register";
import { StatBeacon } from "@/components/stats/stat-beacon";
import { APP_DESCRIPTION, APP_TAGLINE, appName } from "@/lib/brand";
import { requestLang } from "@/lib/i18n/request-lang";
import { sulweOn } from "@/lib/sulwe";
import { guidedTourOn } from "@/lib/tour";
import { publicOrigin } from "@/lib/payments/origin";
import { PWA_THEME_COLOR, pwaNames } from "@/lib/pwa";
import "./globals.css";

export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: PWA_THEME_COLOR,
};

export async function generateMetadata(): Promise<Metadata> {
  const name = appName();
  const { shortName } = pwaNames(name);
  const description = `${APP_TAGLINE} ${APP_DESCRIPTION}`;
  return {
    metadataBase: new URL(await publicOrigin()),
    applicationName: name,
    title: { default: name, template: `%s · ${name}` },
    description,
    appleWebApp: {
      capable: true,
      title: shortName,
      statusBarStyle: "black",
    },
    // Next emits mobile-web-app-capable from appleWebApp.capable. Older iOS still reads this name.
    other: {
      "apple-mobile-web-app-capable": "yes",
    },
    openGraph: {
      type: "website",
      siteName: name,
      title: name,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const installName = pwaNames(appName()).shortName;
  const lang = await requestLang();
  const tourOn = guidedTourOn();
  const sulweFlag = sulweOn();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] font-sans print:pb-0 md:pb-0">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-30 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-md"
        >
          Skip to content
        </a>
        <Header />
        <PwaRegister />
        <StatBeacon />
        <main id="main" className="page-enter flex-1">
          <Suspense fallback={null}>
            <BackBar brand={appName()} />
          </Suspense>
          <InstallPrompt appName={installName} />
          {children}
        </main>
        <Footer replay={tourOn ? <TourReplay lang={lang} /> : null} />
        <Suspense fallback={null}>
          <GuidedTour enabled={tourOn} lang={lang} sulwe={sulweFlag} />
          <Sulwe enabled={sulweFlag} lang={lang} />
        </Suspense>
      </body>
    </html>
  );
}

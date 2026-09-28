import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Figtree } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { APP_DESCRIPTION, APP_TAGLINE, appName } from "@/lib/brand";
import { publicOrigin } from "@/lib/payments/origin";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const name = appName();
  const description = `${APP_TAGLINE} ${APP_DESCRIPTION}`;
  return {
    metadataBase: new URL(await publicOrigin()),
    applicationName: name,
    title: { default: name, template: `%s · ${name}` },
    description,
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-30 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow-md"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="page-enter flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

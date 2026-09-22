import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, Figtree } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from "@/lib/brand";
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

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: `${APP_TAGLINE} ${APP_DESCRIPTION}`,
};

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

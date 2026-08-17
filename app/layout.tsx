import "./globals.css";

import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { headers } from "next/headers";

import { Providers } from "@/components/providers";
import { ThemeScript } from "@/components/theme-script";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AIESEC Pulse",
  description: "The global news platform for AIESEC entities worldwide.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the nonce makes every page dynamic — the documented cost of a
  // nonce-based CSP, accepted because the feed is per-viewer anyway.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      dir="ltr"
      className={`${lato.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeScript nonce={nonce} />
        {/*
          WCAG 2.4.1 Bypass Blocks. Visually hidden until focused, then pinned
          above the sticky header so 2.4.11 (Focus Not Obscured) holds too.
        */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-sm)] focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-[15px] focus:font-bold focus:text-[var(--primary-foreground)]"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

import "./globals.css";

import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Lato } from "next/font/google";
import { headers } from "next/headers";

import { BootScript } from "@/components/boot-script";
import { Providers } from "@/components/providers";

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      dir="ltr"
      // Server default; BootScript overrides it before first paint when the
      // member has chosen Reduced. `suppressHydrationWarning` above covers the
      // divergence, exactly as it already does for the theme class.
      data-motion="full"
      className={`${lato.variable} ${instrumentSerif.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <BootScript nonce={nonce} />
        {/*
          WCAG 2.4.1 Bypass Blocks. Visually hidden until focused, then pinned
          above the sticky header so 2.4.11 (Focus Not Obscured) holds too.
        */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-sm)] focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-[15px] focus:font-bold focus:text-[color:var(--primary-foreground)]"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

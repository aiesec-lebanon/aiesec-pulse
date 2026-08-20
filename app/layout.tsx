import "./globals.css";

import type { Metadata } from "next";
import { Lato } from "next/font/google";
import { headers } from "next/headers";

import { BootScript } from "@/components/boot-script";
import { Providers } from "@/components/providers";

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
      // Server default; BootScript overrides it before first paint when the
      // member has chosen Reduced. `suppressHydrationWarning` above covers the
      // divergence, exactly as it already does for the theme class.
      data-motion="full"
      className={`${lato.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {/*
          DIRECTION CONTRACT — AIESEC Pulse, cinematic reader flow

          THESIS: Depth encodes distance in the network. What is near a member
          (their entity, their topics, the lead story) sits forward and lit;
          the wider network recedes into a cooler field behind. Refuses the
          category default this product had shipped — a flat grey ground under
          uniform bordered cards, with no z-axis and no focal point.

          OWN-WORLD: The AIESEC tokens unchanged (blue #037ef3 leading, teal
          and orange as meaning accents), redeployed as fields and light rather
          than 1px outlines: a lit stage, plates carrying real offset+blur
          elevation, and a projected point-cloud of the network as the only
          ornament. Lato pushed to both extremes — 900 at up to 96px against
          400/18px body, plus a 12px tracked uppercase micro-label register.

          STORY: A member arrives at a sign-in screen where the network
          resolves out of the dark, signs in, meets a lead story that fills the
          viewport with parallax depth, and reads down a page that rises into
          place as they scroll.

          FIRST VIEWPORT (feed): full-bleed lead cover with a parallax
          foreground, the headline in 900-weight over a vertical scrim at lower
          left, one tracked metadata line, and Latest/For You as the only tab
          control on the page.

          FORM: Motion is on by default for everyone and governed by an
          explicit in-app Motion control (§8.2), not an inferred OS setting.
          Depth is CSS 3-D and 2-D canvas projection, never WebGL —
          context.md §11.2 defers that.

          FINISH: unreviewed and undocumented is unfinished; this build ends
          with the finish review, the verdict, DESIGN.md, and every shipping
          raster carrying its provenance.
        */}
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

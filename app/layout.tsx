import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/auth-context";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lato.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        {/* ThemeScript uses useServerInsertedHTML — injected as raw HTML during
            SSR streaming, never processed by React's virtual DOM. No warning. */}
        <ThemeScript />
        <Providers>
          <AuthProvider>
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

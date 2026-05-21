import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/auth-context";
import { AppHeader } from "@/components/layout/AppHeader";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lato.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Providers>
          <AuthProvider>
            <AppHeader />
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}

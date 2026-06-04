import type { Metadata } from "next";
import Script from "next/script";
import { Jersey_25 } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const jersey25 = Jersey_25({
  variable: "--font-jersey-25",
  subsets: ["latin"],
  weight: ["400"],
});

const departureMono = localFont({
  src: "../../public/fonts/DepartureMono-Regular.woff2",
  variable: "--font-departure-mono",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Lineage 2 API",
  description:
    "A clean, read-only HTTP API for Lineage 2 Interlude game data: items, NPCs, monsters, drops, quests, classes, locations, and more.",
  icons: {
  icon: [
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
  apple: [
      { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jersey25.variable} ${departureMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--ink)]">
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="fcbbfa3e-b709-4804-bf2c-f9fecdcccab9"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  );
}

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

const SITE_TITLE =
  "Lineage 2 Interlude API — Items, NPCs, Drops & Quests as JSON";

const SITE_DESCRIPTION =
  "Clean JSON data for Lineage 2 Interlude: items, NPCs, drops, quests, skills, spawns, shops, and locations — parsed, normalized, deduplicated, and cross-linked.";

export const metadata: Metadata = {
  metadataBase: new URL("https://l2api.dev"),
  title: {
    default: SITE_TITLE,
    template: "%s — Lineage 2 API",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Lineage 2 Interlude API",
    "Lineage 2 API",
    "Lineage 2 Interlude data",
    "Lineage 2 items API",
    "Lineage 2 NPC API",
    "Lineage 2 drops API",
    "Lineage 2 quests API",
    "Lineage 2 JSON data",
    "Lineage 2 datapack parser",
    "Interlude API docs",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Lineage 2 API",
    url: "https://l2api.dev",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/landing-icons/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Lineage 2 Interlude API",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/landing-icons/og-image.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
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

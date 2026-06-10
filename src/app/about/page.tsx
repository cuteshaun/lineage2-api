import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/landing/SiteHeader";

const iaWriterQuattro = localFont({
  src: "../../../public/fonts/ia-writer-quattro-latin-400-normal.woff2",
  weight: "400",
  display: "swap",
});

const ABOUT_DESCRIPTION =
  "About the Lineage 2 API project: its origins, motivation, and the community it was built for.";

export const metadata: Metadata = {
  // Renders as "About — Lineage 2 API" via the root title template.
  title: "About",
  description: ABOUT_DESCRIPTION,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    url: "https://l2api.dev/about",
    title: "About — Lineage 2 API",
    description: ABOUT_DESCRIPTION,
    images: [
      {
        url: "/landing-icons/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Lineage 2 Interlude API",
      },
    ],
  },
};

const bodyTextStyle = {
  letterSpacing: "0",
  color: "var(--ink-soft)",
} as const;

const leadTextStyle = {
  letterSpacing: "0",
  color: "var(--ink)",
} as const;

export default function AboutPage() {
  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 pb-20 pt-12 sm:px-10 lg:px-16 lg:pt-16">
        <article className="mx-auto max-w-[720px]">
          <h1
            className="font-display uppercase"
            style={{
              fontSize: "clamp(40px, 6vw, 72px)",
              lineHeight: "0.95",
              letterSpacing: "0.01em",
              color: "var(--ink)",
            }}
          >
            Why this exists
          </h1>

          <p
            className={`${iaWriterQuattro.className} mt-9 text-[20px] leading-[1.7]`}
            style={leadTextStyle}
          >
            Lineage 2 API is my tribute to the community, old servers, and the
            nostalgia of exploring this world together.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            I started playing in 2004 when I was 11, at a computer club called EXE in
            Odesa, Ukraine. My first chronicle was C1 on TeNeT, a local server
            where everything felt mysterious. I barely spoke English, there were
            almost no guides, and we learned the game by exploring, asking each
            other, and figuring things out together.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            That was the magic for me: not just the game, but the people.
            Intrigues, clan wars, sieges, epic bosses, love stories, and
            marketplace scams. Real-life clan parties. For many of us, Lineage 2
            was a place where we grew up, found lifelong friends, and sometimes
            even started families.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            Years later, I wanted to build something the 11-year-old version of
            me would have loved: a better way to explore the world of Lineage 2.
            But instead of making just another wiki, I wanted to create a
            foundation for other community members and developers to build their
            own tools on.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            I looked for a public API for Lineage 2 data and could not find one.
            There were datapacks, scattered XML files, SQL dumps, client files,
            and engine-specific conventions, but not a simple API built for
            developers.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            So I did the boring part.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            This API parses the source data, normalizes it, deduplicates noisy
            records, enriches entities with useful cross-links, and exposes
            clean HTTP endpoints. Raw routes are available too, for those who
            need source-faithful data.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            The current focus is Interlude, the chronicle closest to my own
            memories and the one many players still recognize instantly. More
            chronicles may come later.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            Use it to build an item explorer, drop calculator, Discord bot,
            knowledge base, or anything that brings this old world back to life.
          </p>

          <p
            className={`${iaWriterQuattro.className} mt-7 text-[18px] leading-[1.6]`}
            style={bodyTextStyle}
          >
            I built it because I wanted something like this to exist.
          </p>
        </article>
      </main>
    </div>
  );
}

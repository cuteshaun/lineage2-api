import Image from "next/image";
import Link from "next/link";

const ICON_BASE = "/landing-icons";
const pixel = { imageRendering: "pixelated" as const };

export function SiteHeader() {
  return (
    <header className="relative w-full bg-[var(--bg)]">
      <div className="mx-auto flex h-[88px] w-full max-w-[1440px] items-center gap-6 px-6 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-4">
          <div className="relative flex w-full md:w-[260px] shrink-0">
            <span
              className="logo-text font-display md:text-[28px] text-[22px] uppercase tracking-[0.04em]"
              style={{ color: "var(--ink)", lineHeight: "1" }}
            >
              LINEAGE 2 API
            </span>

            <span
              className="logo-text--mobile font-display md:text-[28px] text-[22px] uppercase tracking-[0.04em]"
              style={{ color: "var(--ink)", lineHeight: "1" }}
            >
              L2 API
            </span>


            <Image
              src={`${ICON_BASE}/stormbringer.png`}
              className="absolute left-[-60px] top-[28px] w-[250px] max-w-none"
              width={200}
              height={44}
              alt=""
              style={pixel}
              priority
              unoptimized
            />
          </div>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-12 text-[15px] font-extrabold uppercase tracking-[0.1em]">
          <a href="https://docs.l2api.dev/" className="hover:text-[var(--gold-ink)]">
            Docs
          </a>
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 hover:text-[var(--gold-ink)]"
          >
            About
          </Link>
        </nav>

        <a
          href="https://buymeacoffee.com/cuteshaun"
          target="_blank"
          rel="noreferrer"
          className="btn-sponsor"
        >
          <span className="btn-sponsor__text">Sponsor</span>
          <Image
            src={`${ICON_BASE}/07_sponsor_heart.png`}
            width={16}
            height={16}
            alt=""
            style={pixel}
            unoptimized
          />
        </a>
      </div>


      <div className="header-separator pointer-events-none absolute bottom-0 left-0 right-0 z-0">
    <div className="mx-auto flex max-w-[1440px] px-6 sm:px-10 lg:px-16">
      <div className="w-[210px]" />
      <div className="h-[2px] flex-1 bg-[var(--border)]" />
    </div>
    </div>
    </header>
  );
}

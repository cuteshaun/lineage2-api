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
          href="https://github.com/cuteshaun/lineage2-api"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub repository"
          className="text-[var(--ink)] transition-colors hover:text-[var(--gold-ink)]"
        >
          <svg
            viewBox="0 0 16 16"
            width={28}
            height={28}
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>

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

import Image from "next/image";
import Link from "next/link";

const ICON_BASE = "/landing-icons";
const pixel = { imageRendering: "pixelated" as const };

export function SiteHeader() {
  return (
    <header className="w-full border-b-2 border-[var(--border)] bg-[var(--bg)]">
      <div className="mx-auto flex h-[88px] w-full max-w-[1440px] items-center gap-6 px-6 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-4">
          <Image
            src={`${ICON_BASE}/01_header_sword_logo.png`}
            width={44}
            height={44}
            alt=""
            style={pixel}
            priority
            unoptimized
          />
          <div className="flex flex-col leading-none">
            <span
              className="font-display text-[28px] uppercase tracking-[0.04em]"
              style={{ color: "var(--ink)", lineHeight: "1" }}
            >
              LINEAGE 2 API
            </span>
          </div>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-12 text-[15px] font-extrabold uppercase tracking-[0.1em]">
          <a href="https://docs.l2api.dev/" className="hover:text-[var(--blue)]">
            Docs
          </a>
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 hover:text-[var(--blue)]"
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
          Sponsor
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
    </header>
  );
}

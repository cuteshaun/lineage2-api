import Image from "next/image";
import Link from "next/link";

const ICON_BASE = "/landing-icons";
const pixel = { imageRendering: "pixelated" as const };

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[var(--bg)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 pb-10 sm:px-10 lg:px-16">
        <Hero />
        <StatsRow />
        <Disclaimer />
      </main>
    </div>
  );
}

/* =================== HEADER =================== */

function SiteHeader() {
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
          <a
            href="https://github.com/cuteshaun/lineage2-api"
            className="inline-flex items-center gap-1.5 hover:text-[var(--blue)]"
          >
            About
          </a>
        </nav>

        <a href="https://buymeacoffee.com/cuteshaun" target="_blank" rel="noreferrer" className="btn-sponsor">
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

/* =================== HERO =================== */

function Hero() {
  return (
    <section className="hero-grid pt-12 lg:pt-[72px]">
      <div className="flex flex-col">
        <div className="chronicle-badge" aria-label="Current chronicle">
          <span className="chronicle-badge__label">Chronicle</span>
          <span className="chronicle-badge__value">Interlude</span>
        </div>

        <h1
          className="font-display mt-8 uppercase lg:whitespace-nowrap"
          style={{
            fontSize: "clamp(48px, 8.5vw, 100px)",
            lineHeight: "0.86",
            letterSpacing: "0.01em",
            color: "var(--ink)",
            marginBottom: "26px",
          }}
        >
          Lineage 2 API
        </h1>

        <div className="flex items-center gap-3">
          <Image
            src={`${ICON_BASE}/09_stats_sword.png`}
            width={22}
            height={22}
            alt=""
            style={pixel}
            unoptimized
          />
          <div className="h-[1.5px] w-[440px] max-w-full shrink-0 divider-dotted-gold" />
          <Image
            src={`${ICON_BASE}/02_interlude_sparkle.png`}
            width={14}
            height={14}
            alt=""
            style={pixel}
            unoptimized
          />
        </div>

        <p
          className="mt-9 max-w-[590px] text-[18px] font-medium leading-[1.55]"
          style={{ color: "var(--ink-soft)" }}
        >
          A clean HTTP API for Interlude game data: items, NPCs, monsters,
          drops, quests, classes, locations, and more.
        </p>
        <p
          className="mt-[22px] max-w-[590px] text-[18px] font-medium leading-[1.55]"
          style={{ color: "var(--ink-soft)" }}
        >
          Built for tools, websites, bots, spreadsheets, and community projects.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-7">
          <a
            href="https://docs.l2api.dev/"
            className="btn-brutal btn-brutal-primary"
          >
            <Image
              src={`${ICON_BASE}/03_docs_book.png`}
              width={20}
              height={20}
              alt=""
              style={pixel}
              unoptimized
            />
            Docs
          </a>
          <a href="https://explorer.l2api.dev/interlude" className="btn-brutal btn-brutal-secondary">
            <Image
              src={`${ICON_BASE}/04_knowledge_q_circle.png`}
              width={20}
              height={20}
              alt=""
              style={pixel}
              unoptimized
            />
            Knowledge Base
          </a>
          {/* <a
            href="#download"
            className="inline-flex items-center gap-2.5 text-[15px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink)]"
          >
            <Image
              src={`${ICON_BASE}/05_download_arrow.png`}
              width={20}
              height={20}
              alt=""
              style={pixel}
              unoptimized
            />
            <span className="link-download">Download Datapack</span>
          </a> */}
        </div>
      </div>

      <div className="w-full lg:w-[515px] lg:justify-self-end lg:ml-auto">
        <BloodyOrchidCard />
      </div>
    </section>
  );
}

/* =================== CARD =================== */

function BloodyOrchidCard() {
  return (
    <article
      className="relative border-[3px] mb-5 border-[var(--border)] bg-[var(--surface)] shadow-card-gold"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRadius: "var(--radius)",
        padding: "28px 32px",
        minHeight: "300px",
      }}
    >
      <div
        className="grid items-start"
        style={{ gridTemplateColumns: "140px 1fr", gap: "28px" }}
      >
        <div
          className="flex shrink-0 items-center justify-center border-2 border-[var(--border-soft)] bg-[var(--bg)]"
          style={{ width: "142px", height: "142px", borderRadius: "4px" }}
        >
          <Image
            src={`${ICON_BASE}/bloody1-orchid.png`}
            width={110}
            height={130}
            alt="Bloody Orchid"
          />
        </div>

        <div className="flex flex-col">
          <h3
            className="text-[28px] font-black uppercase"
            style={{
              color: "var(--ink)",
              lineHeight: "1",
              letterSpacing: "0.02em",
            }}
          >
            Bloody Orchid
          </h3>

          <span
            className="mt-3 inline-flex w-fit border border-[var(--gold-strong)] bg-[var(--gold-soft)] px-2 py-1 text-[12px] font-extrabold uppercase"
            style={{ letterSpacing: "0.12em", color: "var(--ink)" }}
          >
            Weapon
          </span>

          <span
            className="mt-[14px] text-[15px] leading-relaxed"
            style={{ color: "var(--ink)" }}
          >
            A-grade dagger
          </span>

          <p
            className="mt-[14px] text-[15px] font-extrabold"
            style={{ color: "var(--blue)" }}
          >
            <span>GET</span> <span>/api/interlude/items/235</span>
          </p>
        </div>
      </div>

      <div className="my-[26px] divider-dashed-soft" />

      <a
        href="https://l2api.dev//api/interlude/items/235"
        className="inline-flex items-center gap-2 text-[15px] font-extrabold uppercase tracking-[0.12em] text-[var(--blue)] hover:underline"
      >
        Open JSON
        <ArrowRightIcon className="h-4 w-4" />
      </a>
    </article>
  );
}

/* =================== STATS =================== */

type Stat = {
  iconFile: string;
  value: string;
  label: string;
};

const STATS: Stat[] = [
  { iconFile: "09_stats_sword.png", value: "9,206", label: "Items" },
  { iconFile: "10_npc_person.png", value: "6,472", label: "NPCs" },
  { iconFile: "11_monster_skull.png", value: "3,150", label: "Monsters" },
  { iconFile: "12_droplet.png", value: "40,878", label: "Drops & Spoil" },
  { iconFile: "13_scroll_document.png", value: "329", label: "Quests" },
  // { iconFile: "14_chronicle_compass.png", value: "Interlude", label: "Chronicle" },
];

function StatsRow() {
  return (
    <section
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      style={{
        marginTop: "44px",
        padding: "28px 0 30px",
        borderTop: "1px dashed rgba(227, 173, 22, 0.75)",
        borderBottom: "1px dashed rgba(227, 173, 22, 0.75)",
      }}
    >
      {STATS.map((stat, i) => {
        const isLastInRow = i % 6 === 5;
        return (
          <div
            key={stat.label}
            className={`flex flex-col items-center px-4 text-center ${
              !isLastInRow ? "lg:stats-sep-right" : ""
            }`}
          >
            <Image
              src={`${ICON_BASE}/${stat.iconFile}`}
              width={32}
              height={32}
              alt=""
              style={pixel}
              unoptimized
            />
            <div
              className="mt-3 text-[30px] font-black"
              style={{ lineHeight: "1", color: "var(--ink)" }}
            >
              {stat.value}
            </div>
            <div
              className="mt-2.5 text-[13px] font-extrabold uppercase"
              style={{ letterSpacing: "0.14em", color: "var(--muted)" }}
            >
              {stat.label}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/* =================== DISCLAIMER =================== */

function Disclaimer() {
  return (
    <footer className="mt-9 flex items-start" style={{ gap: "18px" }}>
      <div
        className="shrink-0"
        style={{
          width: "2px",
          height: "24px",
          background: "var(--gold-strong)",
        }}
      />
      <div
        className="flex justify-between w-full text-[14px] leading-[1.5]"
        style={{ color: "var(--muted)" }}
      >
        <p>
          © 2026 Built by{" "}
          <a
            href="https://tsapko.me/"
            target="_blank"
            rel="noopener noreferrer"
          >
            cuteshaun
          </a>
        </p>

        <p>Not affiliated with NCSoft</p>
      </div>
    </footer>
  );
}

/* =================== ARROW (kept inline SVG for blue link) =================== */

function ArrowRightIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 8h10" />
      <path d="M9 4l4 4-4 4" />
    </svg>
  );
}

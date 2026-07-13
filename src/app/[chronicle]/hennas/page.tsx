import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch, apiFetchList } from "@/lib/api/client";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import type { ClassDetailDto, ClassListDto, ClassRefDto } from "@/lib/api/dto/class";
import type {
  HennaDetailDto,
  HennaStatChangesDto,
  HennaSummaryDto,
} from "@/lib/api/dto/henna";

/**
 * M8 hennas catalog — hidden dogfooding route. Not linked from
 * `ChronicleNav`; reachable only by URL or via the "View available
 * hennas →" link on class detail and the "View eligible classes →"
 * link on item detail.
 *
 * Three modes selected by query param:
 *
 *   - default              → full grouped catalog (180 symbols)
 *   - `?classId=<id>`      → grouped catalog filtered to the class's
 *                            `allowedHennas`. Title becomes
 *                            "Hennas for <ClassName>".
 *   - `?symbolId=<id>`     → single-symbol detail view with the full
 *                            `allowedClasses` chip list AND the
 *                            computed `unavailableClasses` chip list.
 *                            This is the canonical home for
 *                            class-restriction details.
 *
 * If both `classId` and `symbolId` are supplied, `symbolId` wins
 * (more specific view).
 *
 * The 9 trailing Greater II tier symbols (172–180) carry mechanics
 * only — `displayName/iconFile/shortLabel` are honestly null. They
 * render with a placeholder name and a dashed icon slot.
 */
// Parameterized views (?classId= / ?symbolId=) stay out of the search
// index — crawlers may still follow links to other (cheap, cached) pages.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{
    classId?: string | string[];
    symbolId?: string | string[];
  }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  return Object.keys(sp).length > 0
    ? { robots: { index: false, follow: true } }
    : {};
}

export default async function HennasPage({
  params,
  searchParams,
}: {
  params: Promise<{ chronicle: string }>;
  searchParams: Promise<{
    classId?: string | string[];
    symbolId?: string | string[];
  }>;
}) {
  const { chronicle } = await params;
  if (!isChronicle(chronicle)) notFound();

  const sp = await searchParams;
  const symbolId = parseQueryNumber(sp.symbolId, { allowZero: false });
  const classId = parseQueryNumber(sp.classId, { allowZero: true });

  if (symbolId != null) {
    return (
      <SymbolDetailMode
        chronicle={chronicle}
        symbolId={symbolId}
      />
    );
  }
  return (
    <CatalogMode chronicle={chronicle} classId={classId} />
  );
}

function parseQueryNumber(
  raw: string | string[] | undefined,
  { allowZero }: { allowZero: boolean }
): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n)) return null;
  if (allowZero ? n < 0 : n <= 0) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Mode 1 / 2 — full catalog (optionally filtered by classId)
// ---------------------------------------------------------------------------

async function CatalogMode({
  chronicle,
  classId,
}: {
  chronicle: string;
  classId: number | null;
}) {
  let hennas: HennaSummaryDto[] = [];
  let total: number | null = null;
  let errorMessage: string | null = null;
  let title = "Hennas";
  let className: string | null = null;
  let invalidClassId = false;

  if (classId != null) {
    // Bounded key space (≤119 classes reachable via real links) — cache.
    const result = await apiFetch<ClassDetailDto>(
      `/api/${chronicle}/classes/${classId}`,
      { revalidate: 3600 }
    );
    if (!result.ok) {
      if (result.status === 404) {
        invalidClassId = true;
      } else {
        errorMessage =
          (result as { error?: string }).error ?? "Failed to load class";
      }
    } else {
      className = result.data.name;
      title = `Hennas for ${result.data.name}`;
      hennas = result.data.allowedHennas ?? [];
      total = hennas.length;
    }
  } else {
    const result = await apiFetchList<HennaSummaryDto>(
      `/api/${chronicle}/hennas`,
      { revalidate: 3600 }
    );
    if (!result.ok) {
      errorMessage = result.error;
    } else {
      hennas = result.data;
      total = result.meta.total;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        {classId != null && (
          <Link
            href={`/${chronicle}/hennas`}
            className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← All hennas
          </Link>
        )}
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h1>
          {total != null && (
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {total.toLocaleString()} total
            </span>
          )}
        </div>
        {classId == null ? (
          <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
            Henna symbols joined from upstream{" "}
            <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
              hennas.xml
            </code>{" "}
            and the L2 client&apos;s{" "}
            <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
              hennagrp-e.dat
            </code>
            . Hennas are stat-altering dyes engraved at a Symbol Maker —
            not cosmetic tattoos. The 9 Greater II tier symbols
            (<span className="font-mono">172</span>–
            <span className="font-mono">180</span>) carry mechanics only;
            display fields are honestly{" "}
            <span className="font-mono">null</span> where the DAT
            compresses data we cannot safely decode.
          </p>
        ) : (
          <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
            Symbols available for{" "}
            <Link
              href={`/${chronicle}/classes/${classId}`}
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {className ?? `class #${classId}`}
            </Link>{" "}
            to engrave at a Symbol Maker, grouped by the{" "}
            <span className="font-medium">positive</span> stat each
            symbol grants.
          </p>
        )}
      </header>

      {errorMessage ? (
        <ErrorBlock message={errorMessage} />
      ) : invalidClassId ? (
        <EmptyBlock message={`Class #${classId} not found.`} />
      ) : hennas.length === 0 ? (
        <EmptyBlock message="No hennas available." />
      ) : (
        <HennasGrouped chronicle={chronicle} hennas={hennas} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 3 — single-symbol detail (full class availability)
// ---------------------------------------------------------------------------

async function SymbolDetailMode({
  chronicle,
  symbolId,
}: {
  chronicle: string;
  symbolId: number;
}) {
  // Bounded key space (≤180 symbols reachable via real links) — cache.
  const [hennaResult, classListResult] = await Promise.all([
    apiFetch<HennaDetailDto>(`/api/${chronicle}/hennas/${symbolId}`, {
      revalidate: 3600,
    }),
    apiFetchList<ClassListDto>(`/api/${chronicle}/classes`, {
      revalidate: 3600,
    }),
  ]);

  if (!hennaResult.ok) {
    if (hennaResult.status === 404) {
      return (
        <SymbolDetailFrame chronicle={chronicle} title={`Symbol #${symbolId}`}>
          <EmptyBlock message={`Henna #${symbolId} not found.`} />
        </SymbolDetailFrame>
      );
    }
    return (
      <SymbolDetailFrame chronicle={chronicle} title="Henna">
        <ErrorBlock
          message={
            (hennaResult as { error?: string }).error ?? "Failed to load henna"
          }
        />
      </SymbolDetailFrame>
    );
  }

  const henna = hennaResult.data;
  const allowedIds = new Set(henna.allowedClasses.map((c) => c.id));
  const unavailable = classListResult.ok
    ? classListResult.data
        .filter((c) => !allowedIds.has(c.id))
        .map((c): ClassRefDto => ({
          id: c.id,
          name: c.name,
          professionLevel: c.professionLevel,
        }))
        .sort((a, b) => a.id - b.id)
    : null;

  const displayName = henna.displayName ?? `Symbol #${henna.symbolId}`;
  // Symbol icon falls back to the dye item icon (different art —
  // `etc_str_symbol_*` vs `etc_str_hena_*`) only when the DAT didn't
  // supply a symbol slug. Same convention as the embedded item-detail
  // block.
  const iconFile = henna.iconFile ?? henna.dyeItem.iconFile;
  const summary = henna.shortLabel ?? formatStatSummary(henna.statChanges);

  return (
    <SymbolDetailFrame
      chronicle={chronicle}
      title={henna.displayName != null ? "Henna" : "Henna (engine record)"}
    >
      <header className="flex items-start gap-4">
        <ItemIcon iconFile={iconFile} name={displayName} size={44} decorative />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
              {displayName}
            </h1>
            <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              symbol #{henna.symbolId}
            </span>
          </div>
          <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
            {summary}
          </span>
        </div>
      </header>

      {henna.displayName == null && (
        <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Display fields unavailable from the L2 client DAT for this
          symbol; mechanics shown below.
        </p>
      )}

      <section className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Mechanics
        </h2>
        <StatChangeBadges changes={henna.statChanges} />
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-xs">
          <div>
            <span className="text-zinc-400 dark:text-zinc-500">Engrave price · </span>
            <span className="text-zinc-900 dark:text-zinc-100">
              {henna.engravePrice.toLocaleString()} a
            </span>
          </div>
          <div>
            <span className="text-zinc-400 dark:text-zinc-500">Dye item · </span>
            <Link
              href={`/${chronicle}/items/${henna.dyeItem.id}`}
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {henna.dyeItem.name}
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Available to ({henna.allowedClasses.length})
        </h2>
        <ClassChipList
          chronicle={chronicle}
          classes={henna.allowedClasses}
          emptyMessage="No classes can engrave this symbol."
        />
      </section>

      {unavailable && unavailable.length > 0 && (
        <section className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Unavailable to ({unavailable.length})
          </h2>
          <ClassChipList
            chronicle={chronicle}
            classes={unavailable}
            emptyMessage="No classes are excluded."
          />
        </section>
      )}
    </SymbolDetailFrame>
  );
}

function SymbolDetailFrame({
  chronicle,
  title,
  children,
}: {
  chronicle: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/hennas`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All hennas
      </Link>
      <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {title}
      </p>
      {children}
    </div>
  );
}

function ClassChipList({
  chronicle,
  classes,
  emptyMessage,
}: {
  chronicle: string;
  classes: ClassRefDto[];
  emptyMessage: string;
}) {
  if (classes.length === 0) {
    return (
      <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
        {emptyMessage}
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5 text-xs">
      {classes.map((c) => (
        <li key={c.id}>
          <Link
            href={`/${chronicle}/classes/${c.id}`}
            className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          >
            {c.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatChangeBadges({ changes }: { changes: HennaStatChangesDto }) {
  const entries = STAT_ORDER.flatMap((stat) => {
    const v = changes[stat];
    return v == null ? [] : [{ stat, value: v }];
  });
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 font-mono text-xs">
      {entries.map(({ stat, value }) => {
        const sign = value > 0 ? "+" : "";
        const colorClass =
          value > 0
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
        return (
          <li key={stat} className={`rounded border px-2 py-0.5 ${colorClass}`}>
            {stat} {sign}
            {value}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers (catalog + filtered)
// ---------------------------------------------------------------------------

const STAT_ORDER: Array<keyof HennaStatChangesDto> = [
  "STR",
  "CON",
  "DEX",
  "INT",
  "MEN",
  "WIT",
];

const STAT_TITLE_CASE: Record<keyof HennaStatChangesDto, string> = {
  STR: "Str",
  CON: "Con",
  DEX: "Dex",
  INT: "Int",
  MEN: "Men",
  WIT: "Wit",
};

function getPrimaryPositiveStat(
  changes: HennaStatChangesDto
): keyof HennaStatChangesDto | null {
  for (const stat of STAT_ORDER) {
    const v = changes[stat];
    if (v != null && v > 0) return stat;
  }
  return null;
}

/**
 * Renders the same compact summary as the DAT's `shortLabel`
 * (e.g. `"Str+1 Con-3"`) — used as a fallback when the DAT row is
 * the Greater II tier and `shortLabel` is null. This is computation
 * over mechanical data, not invented display text.
 */
function formatStatSummary(changes: HennaStatChangesDto): string {
  return STAT_ORDER.flatMap((stat) => {
    const v = changes[stat];
    if (v == null) return [];
    return [`${STAT_TITLE_CASE[stat]}${v > 0 ? "+" : ""}${v}`];
  }).join(" ");
}

function HennasGrouped({
  chronicle,
  hennas,
}: {
  chronicle: string;
  hennas: HennaSummaryDto[];
}) {
  const groups = new Map<keyof HennaStatChangesDto | "OTHER", HennaSummaryDto[]>();
  for (const h of hennas) {
    const key = getPrimaryPositiveStat(h.statChanges) ?? "OTHER";
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(h);
  }
  const orderedKeys: Array<keyof HennaStatChangesDto | "OTHER"> = [
    ...STAT_ORDER,
    "OTHER",
  ];

  return (
    <div className="flex flex-col gap-5">
      {orderedKeys.map((key) => {
        const rows = groups.get(key);
        if (!rows || rows.length === 0) return null;
        const heading = key === "OTHER" ? "Other" : `${STAT_TITLE_CASE[key]}+`;
        return (
          <section key={key} className="flex flex-col gap-2">
            <h2 className="font-mono text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              {heading}{" "}
              <span className="text-zinc-400 dark:text-zinc-500">
                ({rows.length})
              </span>
            </h2>
            <ul className="flex flex-col divide-y divide-zinc-100 rounded border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {rows.map((h) => (
                <HennaRow key={h.symbolId} chronicle={chronicle} henna={h} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function HennaRow({
  chronicle,
  henna,
}: {
  chronicle: string;
  henna: HennaSummaryDto;
}) {
  const summary = henna.shortLabel ?? formatStatSummary(henna.statChanges);
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      {henna.iconFile ? (
        <img
          src={`/icons/${henna.iconFile}`}
          alt=""
          width={24}
          height={24}
          loading="lazy"
          className="flex-none rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
        />
      ) : (
        <span className="flex-none h-6 w-6 rounded border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline gap-2">
          <Link
            href={`/${chronicle}/hennas?symbolId=${henna.symbolId}`}
            className="truncate text-sm text-zinc-900 hover:underline dark:text-zinc-100"
          >
            {henna.displayName ?? `Symbol #${henna.symbolId}`}
          </Link>
          <span className="flex-none font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            #{henna.symbolId}
          </span>
        </div>
        <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
          {summary}
        </span>
      </div>
      <span className="flex-none font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
        {henna.engravePrice.toLocaleString()} a
      </span>
      <Link
        href={`/${chronicle}/items/${henna.dyeItem.id}`}
        className="flex-none font-mono text-[11px] text-indigo-600 hover:underline dark:text-indigo-400"
      >
        dye →
      </Link>
    </li>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      {message}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {message}
    </div>
  );
}

import Link from "next/link";
import { DropsTable } from "./DropsTable";
import { SpawnSummary } from "./SpawnSummary";
import type { Chronicle } from "@/lib/chronicles";
import type { NpcDetailDto } from "@/lib/api/dto/npc";
import type { NpcDropsDto } from "@/lib/api/dto/drops";
import type { EnrichedSpawnDto } from "@/lib/api/dto/spawn";

/**
 * Compact shop summary passed in by the page handler. Counts only —
 * the detail view lives at `/[chronicle]/npcs/[id]/shop`. `null` when
 * the NPC has no buyList and no allow-listed multisells.
 */
export interface NpcShopSummary {
  buyListCount: number;
  exchangesCount: number;
}

export function NpcDetails({
  chronicle,
  npc,
  drops,
  spawns,
  shop,
  kind,
}: {
  chronicle: Chronicle;
  npc: NpcDetailDto;
  drops: NpcDropsDto | null;
  spawns: EnrichedSpawnDto[] | null;
  shop?: NpcShopSummary | null;
  kind: "npc" | "monster";
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {kind} · #{npc.id}
        </p>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {npc.name}
          </h1>
          <span
            className={
              npc.isAggressive
                ? "rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/40 dark:text-red-300"
                : "rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            }
          >
            {npc.isAggressive ? "Aggressive" : "Passive"}
          </span>
          {npc.race && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200 py-0.5 pl-1 pr-2.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
              {npc.raceIconFile && (
                <img
                  src={`/icons/${npc.raceIconFile}`}
                  alt={npc.race}
                  width={18}
                  height={18}
                  className="rounded-full"
                />
              )}
              {npc.race}
            </span>
          )}
        </div>
        {npc.title && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {npc.title}
          </p>
        )}
        {(npc.primaryLocation || npc.primaryRegion) && (
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {npc.primaryLocation && (
              <span>
                <span className="text-zinc-400 dark:text-zinc-500">
                  Location ·{" "}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {npc.primaryLocation.name}
                </span>
              </span>
            )}
            {npc.primaryRegion && (
              <span>
                <span className="text-zinc-400 dark:text-zinc-500">
                  Region ·{" "}
                </span>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {npc.primaryRegion.name}
                </span>
              </span>
            )}
          </p>
        )}
        {npc.raceDescription && (
          <p className="max-w-prose text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {npc.raceDescription}
          </p>
        )}
      </header>

      <Section title="Stats">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs sm:grid-cols-3 md:grid-cols-4">
          <Stat label="Level" value={npc.level} />
          <Stat label="Type" value={npc.npcType} />
          <Stat label="HP" value={npc.stats.hp} />
          <Stat label="MP" value={npc.stats.mp} />
          <Stat label="EXP" value={npc.stats.exp} />
          <Stat label="SP" value={npc.stats.sp} />
          <Stat label="P.Atk" value={npc.stats.pAtk} />
          <Stat label="P.Def" value={npc.stats.pDef} />
          <Stat label="M.Atk" value={npc.stats.mAtk} />
          <Stat label="M.Def" value={npc.stats.mDef} />
          <Stat label="Crit" value={npc.stats.crit} />
          <Stat label="Atk.Spd" value={npc.stats.atkSpd} />
          <Stat label="Walk Spd" value={npc.stats.walkSpd} />
          <Stat label="Run Spd" value={npc.stats.runSpd} />
        </dl>
      </Section>

      {npc.skills.length > 0 && (
        <Section title={`Skills (${npc.skills.length})`}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {npc.skills.map((s) => (
              <li
                key={`${s.id}-${s.level}`}
                className="flex items-start gap-2"
              >
                {s.iconFile ? (
                  <img
                    src={`/icons/${s.iconFile}`}
                    alt={s.name ?? `Skill ${s.id}`}
                    width={24}
                    height={24}
                    loading="lazy"
                    className="flex-none rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"
                  />
                ) : (
                  <span className="flex-none h-6 w-6 rounded border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
                )}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {s.name ?? `#${s.id}`} · Lv {s.level}
                  </span>
                  {s.description && (
                    <span className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {s.description}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {shop && (
        <Section title="Shop">
          <Link
            href={`/${chronicle}/npcs/${npc.id}/shop`}
            className="flex items-center justify-between rounded border border-zinc-100 p-3 text-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            <span className="flex items-baseline gap-3">
              {shop.buyListCount > 0 && (
                <span className="text-zinc-900 dark:text-zinc-100">
                  <span className="font-semibold">{shop.buyListCount}</span>{" "}
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {shop.buyListCount === 1 ? "product" : "products"}
                  </span>
                </span>
              )}
              {shop.exchangesCount > 0 && (
                <span className="text-zinc-900 dark:text-zinc-100">
                  <span className="font-semibold">{shop.exchangesCount}</span>{" "}
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {shop.exchangesCount === 1 ? "exchange" : "exchanges"}
                  </span>
                </span>
              )}
            </span>
            <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400">
              View shop →
            </span>
          </Link>
        </Section>
      )}

      {npc.startsQuests && npc.startsQuests.length > 0 && (
        <Section
          title={
            npc.startsQuests.length === 1
              ? "Starts Quest"
              : `Starts Quests (${npc.startsQuests.length})`
          }
        >
          <ul className="flex flex-col gap-1.5 text-sm">
            {npc.startsQuests.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/${chronicle}/quests/${q.id}`}
                  className="flex items-baseline justify-between gap-3 hover:underline"
                >
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {q.name}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {q.levelMin != null ? `Lv ${q.levelMin}` : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {npc.involvedInQuests && npc.involvedInQuests.length > 0 && (
        <Section
          title={`Involved in Quests (${npc.involvedInQuests.length})`}
        >
          <ul className="flex flex-col gap-1.5 text-sm">
            {npc.involvedInQuests.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/${chronicle}/quests/${q.id}`}
                  className="flex items-baseline justify-between gap-3 hover:underline"
                >
                  <span className="flex items-baseline gap-2 text-zinc-900 dark:text-zinc-100">
                    {q.name}
                    {q.roles && q.roles.length > 0 && (
                      <span className="flex gap-1">
                        {q.roles.map((r) => (
                          <span
                            key={r}
                            className="rounded-full bg-zinc-200 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                          >
                            {r}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {q.levelMin != null ? `Lv ${q.levelMin}` : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Drops">
        <DropsTable chronicle={chronicle} drops={drops?.drops ?? []} />
      </Section>

      {spawns !== null && (
        <Section title="Spawns">
          {spawns.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              No spawn data for this NPC.
            </div>
          ) : (
            <SpawnSummary spawns={spawns} />
          )}
        </Section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  const display =
    value == null
      ? "—"
      : typeof value === "boolean"
        ? value
          ? "Yes"
          : "No"
        : typeof value === "number"
          ? value.toLocaleString()
          : String(value);
  return (
    <div>
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-zinc-900 dark:text-zinc-100">{display}</dd>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

import { DropsTable, type EnrichedDrop } from "./DropsTable";
import { SpawnSummary } from "./SpawnSummary";
import type { Chronicle } from "@/lib/chronicles";
import type { NpcDetailDto } from "@/lib/api/dto/npc";
import type { Spawn } from "@/lib/types";

export interface EnrichedNpcDrops {
  npcId: number;
  npcName: string;
  drops: EnrichedDrop[];
}

export function NpcDetails({
  chronicle,
  npc,
  drops,
  spawns,
  kind,
}: {
  chronicle: Chronicle;
  npc: NpcDetailDto;
  drops: EnrichedNpcDrops | null;
  spawns: Spawn[] | null;
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
        </div>
        {npc.title && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {npc.title}
          </p>
        )}
      </header>

      <Section title="Stats">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs sm:grid-cols-3 md:grid-cols-4">
          <Stat label="Level" value={npc.level} />
          <Stat label="Type" value={npc.npcType} />
          <Stat label="HP" value={npc.hp} />
          <Stat label="MP" value={npc.mp} />
          <Stat label="EXP" value={npc.exp} />
          <Stat label="SP" value={npc.sp} />
          <Stat label="P.Atk" value={npc.pAtk} />
          <Stat label="P.Def" value={npc.pDef} />
          <Stat label="M.Atk" value={npc.mAtk} />
          <Stat label="M.Def" value={npc.mDef} />
          <Stat label="Crit" value={npc.crit} />
          <Stat label="Atk.Spd" value={npc.atkSpd} />
          <Stat label="Walk Spd" value={npc.walkSpd} />
          <Stat label="Run Spd" value={npc.runSpd} />
        </dl>
      </Section>

      {npc.skills.length > 0 && (
        <Section title={`Skills (${npc.skills.length})`}>
          <ul className="grid grid-cols-1 gap-1 font-mono text-xs text-zinc-700 sm:grid-cols-2 md:grid-cols-3 dark:text-zinc-300">
            {npc.skills.map((s) => (
              <li key={`${s.id}-${s.level}`}>
                #{s.id} · level {s.level}
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

import { FieldList } from "./FieldList";
import { DropsTable, type EnrichedDrop } from "./DropsTable";
import { SpawnsTable } from "./SpawnsTable";
import { SpawnMap } from "./SpawnMap";
import type { Chronicle } from "@/lib/chronicles";
import type { Npc, Spawn } from "@/lib/types";

export interface EnrichedNpcDrops {
  npcId: number;
  npcName: string;
  drops: EnrichedDrop[];
}

/**
 * Shared detail view for both `/npcs/[id]` and `/monsters/[id]`. Both
 * routes operate on the same `Npc` shape — monsters are just a filtered
 * subset — so the presentation is identical.
 */
export function NpcDetails({
  chronicle,
  npc,
  drops,
  spawns,
  kind,
}: {
  chronicle: Chronicle;
  npc: Npc;
  drops: EnrichedNpcDrops | null;
  /** Raw spawn rows for this NPC, or `null` if the fetch failed / wasn't run. */
  spawns: Spawn[] | null;
  kind: "npc" | "monster";
}) {
  const identity = [
    { label: "ID", value: npc.id },
    { label: "Name", value: npc.name },
    { label: "Title", value: npc.title },
    { label: "Type", value: npc.npcType },
    { label: "Level", value: npc.level },
  ];

  const vitals = [
    { label: "HP", value: npc.hp },
    { label: "MP", value: npc.mp },
    { label: "hpRegen", value: npc.hpRegen },
    { label: "mpRegen", value: npc.mpRegen },
    { label: "exp", value: npc.exp },
    { label: "sp", value: npc.sp },
  ];

  const combat = [
    { label: "pAtk", value: npc.pAtk },
    { label: "pDef", value: npc.pDef },
    { label: "mAtk", value: npc.mAtk },
    { label: "mDef", value: npc.mDef },
    { label: "crit", value: npc.crit },
    { label: "atkSpd", value: npc.atkSpd },
  ];

  const baseStats = [
    { label: "STR", value: npc.str },
    { label: "INT", value: npc.int },
    { label: "DEX", value: npc.dex },
    { label: "WIT", value: npc.wit },
    { label: "CON", value: npc.con },
    { label: "MEN", value: npc.men },
  ];

  const ai = [
    { label: "aiType", value: npc.aiType },
    { label: "aiAggro", value: npc.aiAggro },
    { label: "aiCanMove", value: npc.aiCanMove },
    { label: "aiSeedable", value: npc.aiSeedable },
    { label: "aiSsCount", value: npc.aiSsCount },
    { label: "aiSsRate", value: npc.aiSsRate },
    { label: "aiSpsCount", value: npc.aiSpsCount },
    { label: "aiSpsRate", value: npc.aiSpsRate },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          {kind} · #{npc.id}
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          {npc.name}
        </h1>
        {npc.title && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{npc.title}</p>
        )}
      </header>

      <Section title="Identity">
        <FieldList fields={identity} />
      </Section>

      <Section title="Vitals">
        <FieldList fields={vitals} />
      </Section>

      <Section title="Combat stats">
        <FieldList fields={combat} />
      </Section>

      <Section title="Base stats">
        <FieldList fields={baseStats} />
      </Section>

      <Section title="AI">
        <FieldList fields={ai} />
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

      {npc.petData && (
        <Section title={`Pet data (${npc.petData.stats.length} levels)`}>
          <FieldList
            fields={[
              { label: "food1", value: npc.petData.food1 },
              { label: "food2", value: npc.petData.food2 },
              { label: "autoFeedLimit", value: npc.petData.autoFeedLimit },
              { label: "hungryLimit", value: npc.petData.hungryLimit },
              { label: "unsummonLimit", value: npc.petData.unsummonLimit },
            ]}
          />
        </Section>
      )}

      <Section title="Drops">
        <DropsTable chronicle={chronicle} drops={drops?.drops ?? []} />
      </Section>

      {spawns !== null && (
        <Section title={`Spawns (${spawns.length})`}>
          <SpawnsTable spawns={spawns} />
        </Section>
      )}

      {/* Spike-quality spawn map. Conditional on having at least one
          spawn — no map section for NPCs with zero spawn data, only the
          table's empty state above. */}
      {spawns !== null && spawns.length > 0 && (
        <Section title="Spawn map">
          <SpawnMap spawns={spawns} />
        </Section>
      )}

      {npc.properties && Object.keys(npc.properties).length > 0 && (
        <Section title="Extra properties">
          <FieldList
            fields={Object.entries(npc.properties).map(([k, v]) => ({
              label: k,
              value: v,
            }))}
          />
        </Section>
      )}

      <Section title="Source">
        <FieldList
          fields={[
            { label: "project", value: npc.source.project },
            { label: "chronicle", value: npc.source.chronicle },
            { label: "file", value: npc.source.file },
          ]}
        />
      </Section>
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

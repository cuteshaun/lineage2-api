import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { NpcDetails } from "@/components/explorer/NpcDetails";
import type { NpcDropsDto } from "@/lib/api/dto/drops";
import type { NpcDetailDto } from "@/lib/api/dto/npc";
import type { Spawn } from "@/lib/types";

export default async function MonsterDetailsPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [monsterResult, dropsResult, spawnsResult] = await Promise.all([
    apiFetch<NpcDetailDto>(`/api/${chronicle}/monsters/${numericId}`),
    apiFetch<NpcDropsDto>(`/api/${chronicle}/npcs/${numericId}/drops`),
    apiFetch<Spawn[]>(`/api/${chronicle}/npcs/${numericId}/spawns`),
  ]);

  if (!monsterResult.ok) {
    if (monsterResult.status === 404) notFound();
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {(monsterResult as { error?: string }).error ?? "Failed to load monster"}
      </div>
    );
  }

  const drops = dropsResult.ok ? dropsResult.data : null;
  const spawns = spawnsResult.ok ? spawnsResult.data : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/monsters`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All monsters
      </Link>
      <NpcDetails
        chronicle={chronicle}
        npc={monsterResult.data}
        drops={drops}
        spawns={spawns}
        kind="monster"
      />
    </div>
  );
}

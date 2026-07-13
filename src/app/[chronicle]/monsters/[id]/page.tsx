import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiErrorMessage, apiFetch } from "@/lib/api/client";
import { NpcDetails } from "@/components/explorer/NpcDetails";
import type { NpcDropsDto } from "@/lib/api/dto/drops";
import type { NpcDetailDto } from "@/lib/api/dto/npc";
import type { EnrichedSpawnDto } from "@/lib/api/dto/spawn";

// On-demand ISR: no ids prerendered at build (pages dogfood the HTTP
// API, unreachable at build time — see lib/api/client.ts); each id is
// generated on first request and cached until the next deploy.
export async function generateStaticParams() {
  return [];
}

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
    apiFetch<EnrichedSpawnDto[]>(`/api/${chronicle}/npcs/${numericId}/spawns`),
  ]);

  if (!monsterResult.ok) {
    if (monsterResult.status === 404) notFound();
    // Throw on failure: under ISR a rendered error block would be cached
    // until the next deploy; a failed generation is not cached and retried.
    throw new Error(apiErrorMessage(monsterResult, "Failed to load monster"));
  }

  // 404s on drops/spawns are legitimate "no data"; any other failure
  // throws instead of caching a degraded render until the next deploy.
  if (!dropsResult.ok && dropsResult.status !== 404) {
    throw new Error(apiErrorMessage(dropsResult, "Failed to load drops"));
  }
  if (!spawnsResult.ok && spawnsResult.status !== 404) {
    throw new Error(apiErrorMessage(spawnsResult, "Failed to load spawns"));
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

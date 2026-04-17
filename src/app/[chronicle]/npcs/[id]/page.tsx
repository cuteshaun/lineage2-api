import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { NpcDetails } from "@/components/explorer/NpcDetails";
import type { NpcDropsDto } from "@/lib/api/dto/drops";
import type { NpcDetailDto } from "@/lib/api/dto/npc";
import type { Spawn } from "@/lib/types";

export default async function NpcDetailsPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  // Fetch NPC detail, drops, and raw spawns in parallel. All three share
  // the same numeric id, so parallel fetching is safe.
  const [npcResult, dropsResult, spawnsResult] = await Promise.all([
    apiFetch<NpcDetailDto>(`/api/${chronicle}/npcs/${numericId}`),
    apiFetch<NpcDropsDto>(`/api/${chronicle}/npcs/${numericId}/drops`),
    apiFetch<Spawn[]>(`/api/${chronicle}/npcs/${numericId}/spawns`),
  ]);

  if (!npcResult.ok) {
    if (npcResult.status === 404) notFound();
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {(npcResult as { error?: string }).error ?? "Failed to load NPC"}
      </div>
    );
  }

  // A 404 from the drops endpoint just means "no drops table" — not fatal.
  const drops = dropsResult.ok ? dropsResult.data : null;

  // The spawns endpoint is `200 + []` when the NPC has zero spawns and 404
  // only if the id is unknown (which we already ruled out above). Treat an
  // unexpected failure as "no data available" (null) rather than blocking
  // the whole page.
  const spawns = spawnsResult.ok ? spawnsResult.data : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/npcs`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All NPCs
      </Link>
      <NpcDetails
        chronicle={chronicle}
        npc={npcResult.data}
        drops={drops}
        spawns={spawns}
        kind="npc"
      />
    </div>
  );
}

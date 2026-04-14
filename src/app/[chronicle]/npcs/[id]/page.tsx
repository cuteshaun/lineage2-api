import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import {
  NpcDetails,
  type EnrichedNpcDrops,
} from "@/components/explorer/NpcDetails";
import type { Npc } from "@/lib/types";

export default async function NpcDetailsPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [npcResult, dropsResult] = await Promise.all([
    apiFetch<Npc>(`/api/${chronicle}/npcs/${numericId}`),
    apiFetch<EnrichedNpcDrops>(`/api/${chronicle}/npcs/${numericId}/drops`),
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
        kind="npc"
      />
    </div>
  );
}

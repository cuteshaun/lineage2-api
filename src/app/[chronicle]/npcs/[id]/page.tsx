import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiErrorMessage, apiFetch } from "@/lib/api/client";
import { NpcDetails, type NpcShopSummary } from "@/components/explorer/NpcDetails";
import type { NpcDropsDto } from "@/lib/api/dto/drops";
import type { NpcDetailDto } from "@/lib/api/dto/npc";
import type { ShopResponseDto } from "@/lib/api/dto/shop";
import type { EnrichedSpawnDto } from "@/lib/api/dto/spawn";

// On-demand ISR: no ids prerendered at build (pages dogfood the HTTP
// API, unreachable at build time — see lib/api/client.ts); each id is
// generated on first request and cached until the next deploy.
export async function generateStaticParams() {
  return [];
}

export default async function NpcDetailsPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  // Fetch NPC detail, drops, raw spawns, and shop summary in parallel.
  // All four share the same numeric id, so parallel fetching is safe.
  const [npcResult, dropsResult, spawnsResult, shopResult] = await Promise.all([
    apiFetch<NpcDetailDto>(`/api/${chronicle}/npcs/${numericId}`),
    apiFetch<NpcDropsDto>(`/api/${chronicle}/npcs/${numericId}/drops`),
    apiFetch<EnrichedSpawnDto[]>(`/api/${chronicle}/npcs/${numericId}/spawns`),
    apiFetch<ShopResponseDto>(`/api/${chronicle}/npcs/${numericId}/shop`),
  ]);

  if (!npcResult.ok) {
    if (npcResult.status === 404) notFound();
    // Throw on failure: under ISR a rendered error block would be cached
    // until the next deploy; a failed generation is not cached and retried.
    throw new Error(apiErrorMessage(npcResult, "Failed to load NPC"));
  }

  // A 404 from the drops endpoint just means "no drops table" — not fatal.
  // Any other failure throws: under ISR a "no data" render would be
  // cached until the next deploy.
  if (!dropsResult.ok && dropsResult.status !== 404) {
    throw new Error(apiErrorMessage(dropsResult, "Failed to load drops"));
  }
  const drops = dropsResult.ok ? dropsResult.data : null;

  // The spawns endpoint is `200 + []` when the NPC has zero spawns and 404
  // only if the id is unknown (which we already ruled out above). An
  // unexpected failure throws instead of caching a "no data" render.
  if (!spawnsResult.ok && spawnsResult.status !== 404) {
    throw new Error(apiErrorMessage(spawnsResult, "Failed to load spawns"));
  }
  const spawns = spawnsResult.ok ? spawnsResult.data : null;

  if (!shopResult.ok && shopResult.status !== 404) {
    throw new Error(apiErrorMessage(shopResult, "Failed to load shop"));
  }
  // Compact shop summary — counts only, not the full payload. The detail
  // view lives at `/[chronicle]/npcs/[id]/shop`. NPCs with no buyList +
  // no exchanges yield `null`, suppressing the section entirely.
  let shop: NpcShopSummary | null = null;
  if (shopResult.ok) {
    const buyListCount = shopResult.data.buyList?.length ?? 0;
    const exchangesCount = shopResult.data.exchanges?.length ?? 0;
    if (buyListCount > 0 || exchangesCount > 0) {
      shop = { buyListCount, exchangesCount };
    }
  }

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
        shop={shop}
        kind="npc"
      />
    </div>
  );
}

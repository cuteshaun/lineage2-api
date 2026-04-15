import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { MonsterGroupDetails } from "@/components/explorer/MonsterGroupDetails";
import { type EnrichedNpcDrops } from "@/components/explorer/NpcDetails";
import type { MonsterGroupDetail } from "@/lib/api/monster-groups";

type SearchParams = Record<string, string | string[] | undefined>;

function parseVariantParam(sp: SearchParams): number | null {
  const raw = sp.variant;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export default async function MonsterDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ chronicle: string; id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ chronicle, id }, sp] = await Promise.all([params, searchParams]);
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  // Public monster detail returns a MonsterGroupDetail. The backend's smart
  // lookup means [id] can be a group id, any canonical id, or any raw id —
  // all resolve to the same group.
  const result = await apiFetch<MonsterGroupDetail>(
    `/api/${chronicle}/monsters/${numericId}`
  );

  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {(result as { error?: string }).error ?? "Failed to load monster"}
      </div>
    );
  }

  const group = result.data;
  const requestedVariantId = parseVariantParam(sp);

  // Resolve which variant is actually selected: the requested one if valid,
  // otherwise the first variant (forgiving fallback). We need this BEFORE
  // we can fetch drops, since drops belong to the selected variant — so the
  // drops fetch is sequential (one extra round-trip per render). Drops are
  // cached server-side per chronicle, so the cost is small.
  const selectedVariant =
    (requestedVariantId !== null
      ? group.variants.find((v) => v.canonicalId === requestedVariantId)
      : undefined) ?? group.variants[0];

  // Fetch drops for the selected variant. The backend keys drops by raw npc
  // id, and every canonicalId is itself a valid raw npc id (canonicals
  // piggyback on raw ids), so the existing /npcs/[id]/drops endpoint works
  // unchanged. A 404 means "this variant has no drops table" — render empty.
  const dropsResult = selectedVariant
    ? await apiFetch<EnrichedNpcDrops>(
        `/api/${chronicle}/npcs/${selectedVariant.canonicalId}/drops`
      )
    : null;

  const drops = dropsResult && dropsResult.ok ? dropsResult.data : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/monsters`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All monsters
      </Link>
      <MonsterGroupDetails
        chronicle={chronicle}
        group={group}
        selectedVariantId={requestedVariantId}
        drops={drops}
      />
    </div>
  );
}

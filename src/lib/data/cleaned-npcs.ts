/**
 * Cleaned NPC layer — Phase 1 of the simplified cleanup plan.
 *
 * Two layers, no middle tier:
 *
 *   1. RAW layer — every NPC as it appears in the source dataset, preserved
 *      verbatim. Served by the `/api/[chronicle]/raw/*` routes.
 *   2. CLEANED layer (this file) — raw NPCs collapsed by exact `name`. One
 *      cleaned record per unique name. Default for `/api/[chronicle]/npcs/*`
 *      and `/api/[chronicle]/monsters/*`.
 *
 * The older canonical-monsters / monster-groups stack is retired: monsters are
 * now simply `cleanedNpcs.filter(isMonsterType)`. There is no variants UI, no
 * `groupId`, no `otherVariants`.
 *
 * --- Grouping rule ---
 * Exact `name` string equality (case-sensitive, no trimming). No fuzzy match.
 *
 * --- Canonical selection priority (stable, deterministic) ---
 *   1. Prefer raw NPCs that have at least one spawn entry in `spawnlist.sql`
 *      (= the version players actually encounter in the world).
 *   2. Among those, prefer ones that have a drop table (= the version data
 *      consumers want).
 *   3. Tie-break by lowest raw `id` (already the established id convention).
 * If no candidate has spawns, step 1 degenerates and we fall through to step
 * 2, then step 3 — so every name-group still produces a canonical.
 *
 * --- Shape ---
 * A cleaned NPC is the canonical raw `Npc` with `mergedIds` / `mergedCount`
 * overwritten to reflect the whole name-group. Every other field comes from
 * the canonical — consumers see exactly one record per name.
 *
 * --- Drops & spawns aggregation (built alongside cleaning) ---
 * Aggregated maps built here feed the `/npcs/[id]/drops` and
 * `/npcs/[id]/spawns` routes:
 *   - drops:   UNION of all (category × drop-entry) rows across mergedIds,
 *              deduplicated on `(categoryId, itemId, min, max, chance)`.
 *   - spawns:  UNION of all `Spawn` rows across mergedIds, deduplicated on
 *              `(x, y, z, heading, respawnDelay, respawnRandom, periodOfDay)`.
 * The raw on-disk `drops.json` / `spawns.json` are untouched — aggregation is
 * index-build-time only, kept in memory, and only used by cleaned routes.
 */

import type {
  DropEntry,
  Npc,
  NpcDrops,
  NpcDropCategory,
  Spawn,
} from "../types";

export interface BuildCleanedNpcsResult {
  /** One entry per unique raw NPC name. Sorted by canonical `id` ascending. */
  cleaned: Npc[];
  /** Map canonical id → cleaned NPC (fast point lookup). */
  cleanedById: Map<number, Npc>;
  /**
   * Map ANY raw id → the canonical id of its cleaned NPC. A cleaned NPC's own
   * id maps to itself. Used by `/npcs/[id]` and `/monsters/[id]` to accept
   * either the canonical id or any merged raw id transparently.
   */
  mergedIdToCanonicalId: Map<number, number>;
  /** Per-canonical aggregated drops — union across mergedIds, deduped. */
  cleanedDropsById: Map<number, NpcDrops>;
  /** Per-canonical aggregated spawns — union across mergedIds, deduped. */
  cleanedSpawnsById: Map<number, Spawn[]>;
}

/**
 * Build the cleaned NPC layer from raw NPCs and the already-indexed raw
 * drops/spawns lookups. Pure function — no I/O, no chronicle awareness.
 */
export function buildCleanedNpcs(
  rawNpcs: Npc[],
  dropsByNpcId: Map<number, NpcDrops>,
  spawnsByNpcId: Map<number, Spawn[]>
): BuildCleanedNpcsResult {
  // Step 1 — bucket raw NPCs by exact name.
  const byName = new Map<string, Npc[]>();
  for (const n of rawNpcs) {
    let bucket = byName.get(n.name);
    if (!bucket) {
      bucket = [];
      byName.set(n.name, bucket);
    }
    bucket.push(n);
  }

  const cleanedById = new Map<number, Npc>();
  const mergedIdToCanonicalId = new Map<number, number>();
  const cleanedDropsById = new Map<number, NpcDrops>();
  const cleanedSpawnsById = new Map<number, Spawn[]>();

  for (const bucket of byName.values()) {
    // Step 2 — pick the canonical raw record using the priority chain.
    const canonical = pickCanonical(bucket, dropsByNpcId, spawnsByNpcId);
    const mergedIds = bucket.map((n) => n.id).sort((a, b) => a - b);

    // Step 3 — materialize the cleaned NPC by overwriting merge metadata on
    // a copy of the canonical. Every other field is canonical-authoritative.
    const cleanedNpc: Npc = {
      ...canonical,
      mergedIds,
      mergedCount: mergedIds.length,
    };
    cleanedById.set(canonical.id, cleanedNpc);

    // Step 4 — map every mergedId (including canonical's own id) → canonical.
    for (const rawId of mergedIds) {
      mergedIdToCanonicalId.set(rawId, canonical.id);
    }

    // Step 5 — aggregate drops + spawns across mergedIds, dedup, attach.
    const aggDrops = aggregateDrops(canonical.id, mergedIds, dropsByNpcId);
    if (aggDrops) cleanedDropsById.set(canonical.id, aggDrops);

    const aggSpawns = aggregateSpawns(mergedIds, spawnsByNpcId);
    if (aggSpawns.length > 0) cleanedSpawnsById.set(canonical.id, aggSpawns);
  }

  const cleaned = [...cleanedById.values()].sort((a, b) => a.id - b.id);
  return {
    cleaned,
    cleanedById,
    mergedIdToCanonicalId,
    cleanedDropsById,
    cleanedSpawnsById,
  };
}

function pickCanonical(
  bucket: Npc[],
  dropsByNpcId: Map<number, NpcDrops>,
  spawnsByNpcId: Map<number, Spawn[]>
): Npc {
  // Priority 1: has spawns. Priority 2: has drops. Tie-break: lowest id.
  // Sorting is stable; rank is 0 (best) … 3 (worst) so ascending sort picks
  // the best candidate first.
  const ranked = [...bucket].sort((a, b) => {
    const ra = rank(a, dropsByNpcId, spawnsByNpcId);
    const rb = rank(b, dropsByNpcId, spawnsByNpcId);
    if (ra !== rb) return ra - rb;
    return a.id - b.id;
  });
  return ranked[0];
}

function rank(
  n: Npc,
  dropsByNpcId: Map<number, NpcDrops>,
  spawnsByNpcId: Map<number, Spawn[]>
): number {
  const hasSpawns = (spawnsByNpcId.get(n.id)?.length ?? 0) > 0;
  const hasDrops = dropsByNpcId.has(n.id);
  if (hasSpawns && hasDrops) return 0;
  if (hasSpawns) return 1;
  if (hasDrops) return 2;
  return 3;
}

/**
 * Union all drop entries across `mergedIds`, bucket them by `categoryId`,
 * and dedup inside each category on `(itemId, min, max, chance)`. The
 * resulting `NpcDrops` is attached to the canonical id; `npcName` is taken
 * from whichever member had a drops record first.
 */
function aggregateDrops(
  canonicalId: number,
  mergedIds: number[],
  dropsByNpcId: Map<number, NpcDrops>
): NpcDrops | null {
  const categoryMap = new Map<
    number | null,
    { seen: Set<string>; drops: DropEntry[] }
  >();
  let anyName: string | null = null;
  let anySource: NpcDrops["source"] | null = null;

  for (const rawId of mergedIds) {
    const src = dropsByNpcId.get(rawId);
    if (!src) continue;
    if (anyName === null) anyName = src.npcName;
    if (anySource === null) anySource = src.source;
    for (const cat of src.categories) {
      let bucket = categoryMap.get(cat.categoryId);
      if (!bucket) {
        bucket = { seen: new Set<string>(), drops: [] };
        categoryMap.set(cat.categoryId, bucket);
      }
      for (const d of cat.drops) {
        const key = `${d.itemId}|${d.min ?? ""}|${d.max ?? ""}|${d.chance ?? ""}`;
        if (bucket.seen.has(key)) continue;
        bucket.seen.add(key);
        bucket.drops.push(d);
      }
    }
  }

  if (categoryMap.size === 0) return null;

  // Stable output: categories sorted by id (nulls last), drops sorted by itemId.
  const categories: NpcDropCategory[] = [...categoryMap.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    })
    .map(([categoryId, v]) => ({
      categoryId,
      drops: [...v.drops].sort((x, y) => x.itemId - y.itemId),
    }));

  return {
    npcId: canonicalId,
    npcName: anyName ?? "",
    categories,
    source: anySource!,
  };
}

/**
 * Union all spawns across `mergedIds` and dedup on the full position tuple.
 * Two variants of "Guard" spawned at identical coordinates with identical
 * respawn parameters would collapse — which matches the observed data,
 * where such duplicates are engine-internal rather than two distinct
 * world-encounter points.
 */
function aggregateSpawns(
  mergedIds: number[],
  spawnsByNpcId: Map<number, Spawn[]>
): Spawn[] {
  const seen = new Set<string>();
  const out: Spawn[] = [];
  for (const rawId of mergedIds) {
    const list = spawnsByNpcId.get(rawId);
    if (!list) continue;
    for (const s of list) {
      const key = `${s.x}|${s.y}|${s.z}|${s.heading}|${s.respawnDelay}|${s.respawnRandom}|${s.periodOfDay}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

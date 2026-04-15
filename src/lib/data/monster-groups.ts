/**
 * Monster group layer — second iteration on top of the canonical layer.
 *
 * Public-API-facing monsters are grouped by **exact monster name**. This
 * layer sits ABOVE the canonical layer, not instead of it:
 *
 *   raw Npc (source-faithful, possibly duplicated)
 *     └─ CanonicalMonster (same-template entries collapsed)
 *         └─ MonsterGroup (same-name canonicals grouped)  ← this file
 *
 * A `MonsterGroup` is one entry per exact monster name. Its `variants` are
 * the canonical monsters that share that name (what the previous iteration
 * called `otherVariants`). Every raw monster id maps to exactly one
 * canonical id, which maps to exactly one group id.
 *
 * --- Grouping rule ---
 * Group by `CanonicalMonster.representative.name` with strict string
 * equality. No fuzzy matching, no prefix matching, no family inference.
 *
 * --- Group identity ---
 * `groupId` is the lowest `canonicalId` among the group's variants. This
 * piggybacks on the canonical-id scheme (which in turn piggybacks on the
 * lowest raw id in each canonical's template group), so the URL-visible id
 * is stable and deterministic with no new numbering scheme introduced.
 *
 * --- Forgiving lookup ---
 * `getGroupIdForAnyMonsterId(id)` accepts any raw monster id OR any
 * canonical id OR a group id. They all resolve to the same `MonsterGroup`.
 * This mirrors the forgiving `getCanonicalMonsterByAnyId` convention
 * established at the canonical layer.
 *
 * This module is UI/API-free — pure types and pure functions. The cached
 * chronicle index in `indexes.ts` calls `buildMonsterGroups` once per
 * chronicle and stores the result.
 */

import type { CanonicalMonster } from "./canonical-monsters";

export interface MonsterGroup {
  /** Stable group id = lowest canonicalId among variants. */
  groupId: number;
  /** Exact monster name this group represents. */
  name: string;
  /**
   * Canonical monsters that share this exact name. Always sorted by
   * `canonicalId` ascending. Length >= 1. The variant whose canonicalId
   * equals `groupId` is the group's natural "primary" variant (first
   * element of the array).
   */
  variants: CanonicalMonster[];
}

export interface BuildMonsterGroupsResult {
  groups: MonsterGroup[];
  /** Lookup by groupId. */
  groupsById: Map<number, MonsterGroup>;
  /** Map every canonicalId to its containing groupId. */
  canonicalIdToGroupId: Map<number, number>;
}

/**
 * Group canonical monsters by exact name. Pure function — no I/O, no
 * chronicle awareness.
 */
export function buildMonsterGroups(
  canonicals: CanonicalMonster[]
): BuildMonsterGroupsResult {
  // Step 1: bucket canonicals by exact name.
  const byName = new Map<string, CanonicalMonster[]>();
  for (const c of canonicals) {
    const name = c.representative.name;
    let bucket = byName.get(name);
    if (!bucket) {
      bucket = [];
      byName.set(name, bucket);
    }
    bucket.push(c);
  }

  // Step 2: build a MonsterGroup per bucket. groupId = lowest canonicalId;
  // variants sorted by canonicalId ascending.
  const groupsById = new Map<number, MonsterGroup>();
  const canonicalIdToGroupId = new Map<number, number>();

  for (const bucket of byName.values()) {
    bucket.sort((a, b) => a.canonicalId - b.canonicalId);
    const groupId = bucket[0].canonicalId;
    const group: MonsterGroup = {
      groupId,
      name: bucket[0].representative.name,
      variants: bucket,
    };
    groupsById.set(groupId, group);
    for (const variant of bucket) {
      canonicalIdToGroupId.set(variant.canonicalId, groupId);
    }
  }

  // Final array: sorted by groupId for stable iteration.
  const groups = [...groupsById.values()].sort(
    (a, b) => a.groupId - b.groupId
  );

  return { groups, groupsById, canonicalIdToGroupId };
}

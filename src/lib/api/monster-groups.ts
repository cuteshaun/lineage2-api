/**
 * Public monster group view layer.
 *
 * The public `/monsters` endpoint returns one entry per exact monster name.
 * Each entry is a `MonsterGroupSummary` (in the list) or a
 * `MonsterGroupDetail` (single resource). Detail responses nest the
 * existing `CanonicalMonsterView` for each variant — the canonical layer's
 * shape is preserved verbatim, just composed inside a group wrapper.
 *
 * --- Aggregation rules for list summaries ---
 *
 * The list summary deliberately exposes ONLY fields that are safely
 * aggregatable across variants. Per-variant template fields (hp, pAtk,
 * skills, etc.) are intentionally NOT in the summary — that would either
 * pick a misleading "primary" variant value or attempt aggregation that
 * isn't meaningful. Consumers who need per-variant template fields hit the
 * detail endpoint.
 *
 * Aggregations chosen:
 *   - `variantsCount`     : variants.length (always >= 1)
 *   - `levelRange`        : { min, max } of variants' levels; null if any
 *                           variant has no level
 *   - `npcTypes`          : sorted unique npcType values across variants
 *   - `source`            : project + chronicle (always shared)
 *
 * Anything else (drops, skills, combat stats) is deliberately omitted from
 * the list summary. That's the price of the "list shows aggregates, never
 * single-variant data" honesty rule.
 */

import type { MonsterGroup } from "../data/monster-groups";
import {
  toCanonicalMonsterView,
  type CanonicalMonsterView,
} from "./monsters";

export interface MonsterGroupSummary {
  id: number;
  name: string;
  variantsCount: number;
  levelRange: { min: number; max: number } | null;
  npcTypes: string[];
  source: { project: "acis"; chronicle: "interlude" };
}

export interface MonsterGroupDetail {
  id: number;
  name: string;
  variantsCount: number;
  source: { project: "acis"; chronicle: "interlude" };
  /**
   * Canonical variants under this exact name. Each variant uses the same
   * `CanonicalMonsterView` shape served by the previous iteration —
   * including `sameTemplateEntries` (raw ids that share the variant's
   * template). `otherVariants` is intentionally omitted at the variant
   * level here because the variants are now siblings under one group.
   */
  variants: CanonicalMonsterView[];
}

function aggregateSource(group: MonsterGroup): MonsterGroupDetail["source"] {
  // All variants live in the same chronicle/project by construction.
  const r = group.variants[0].representative.source;
  return { project: r.project, chronicle: r.chronicle };
}

function aggregateLevelRange(
  group: MonsterGroup
): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let anyNull = false;
  for (const v of group.variants) {
    const lv = v.representative.level;
    if (lv === null) {
      anyNull = true;
      continue;
    }
    if (lv < min) min = lv;
    if (lv > max) max = lv;
  }
  // If any variant has no level, treat the range as unknown rather than
  // pretending the partial range is authoritative for the whole group.
  if (anyNull || min === Number.POSITIVE_INFINITY) return null;
  return { min, max };
}

function aggregateNpcTypes(group: MonsterGroup): string[] {
  const set = new Set<string>();
  for (const v of group.variants) {
    if (v.representative.npcType !== null) set.add(v.representative.npcType);
  }
  return [...set].sort();
}

export function toMonsterGroupSummary(
  group: MonsterGroup
): MonsterGroupSummary {
  return {
    id: group.groupId,
    name: group.name,
    variantsCount: group.variants.length,
    levelRange: aggregateLevelRange(group),
    npcTypes: aggregateNpcTypes(group),
    source: aggregateSource(group),
  };
}

export function toMonsterGroupDetail(
  group: MonsterGroup
): MonsterGroupDetail {
  return {
    id: group.groupId,
    name: group.name,
    variantsCount: group.variants.length,
    source: aggregateSource(group),
    variants: group.variants.map(toCanonicalMonsterView),
  };
}

import type { Chronicle } from "../../chronicles";
import type { HuntingZone, Spawn } from "../../types";
import { resolveLocationForSpawn } from "../../data/indexes";

/**
 * Compact reference to a player-facing L2 hunting / map location
 * (e.g. *"Cruma Tower"*, *"Ant Nest"*, *"Sea of Spores"*). Source:
 * `huntingzone-e.dat` center anchors. Used by:
 *
 *   - `EnrichedSpawnDto.location` — the resolved location for a
 *     single spawn point, via nearest-anchor lookup within a
 *     fixed distance threshold.
 *   - `NpcDetailDto.primaryLocation?` /
 *     `MonsterDetailDto.primaryLocation?` —
 *     the most-frequent location across an NPC's cleaned spawns
 *     (mode-of-spawns, lowest-id tiebreak).
 *   - `QuestDetailDto.primaryLocation?` — the first start NPC's
 *     primary location.
 *   - `GET /api/[chronicle]/locations` — the public catalog (209
 *     spatial entries on Interlude).
 *
 * **Important — not polygon-accurate.** `huntingzone-e.dat`
 * carries only a single `(x, y, z)` center anchor per zone, not a
 * polygon. Resolution is therefore *nearest-anchor-with-threshold*
 * (default 10000 game units, 2D planar) — a player-facing
 * approximation, not a geometric containment check. Coordinates
 * outside the threshold from every anchor resolve to `null`. This
 * is honest behavior, not a bug.
 *
 * `LocationRefDto` is **complementary to** `RegionRefDto` (M4),
 * not a replacement:
 *
 *   - `primaryRegion` (M4) = coarse engine "death-teleport" region
 *     (19 entries continent-wide, e.g. *"Town of Schuttgart"*).
 *   - `primaryLocation` (M7) = fine player-facing area
 *     (209 entries, e.g. *"Cruma Tower"*, *"Ant Nest"*).
 *
 * Both can be present on the same DTO and they answer different
 * player questions.
 */
export interface LocationRefDto {
  /** Source DAT id (1..220 in Interlude). Stable across builds. */
  id: number;
  /** Player-facing name. */
  name: string;
  /**
   * Recommended minimum player level. `null` when the source
   * carries no level signal (e.g. towns and non-combat areas
   * have `0` in the DAT, surfaced as `null` here for predictable
   * client typing).
   */
  minLevel: number | null;
}

export function toLocationRefDto(zone: HuntingZone): LocationRefDto {
  return {
    id: zone.id,
    name: zone.name,
    minLevel: zone.minLevel > 0 ? zone.minLevel : null,
  };
}

/**
 * Computes the **primary location** of an NPC from a list of its
 * cleaned spawns: the most frequent non-null nearest-zone (mode
 * by zone id), with a stable lowest-id tiebreak. Mirrors the
 * `computePrimaryRegion` rule from M4. Returns `null` when:
 *
 *   - the NPC has no spawns at all, or
 *   - every spawn falls outside the
 *     {@link LOCATION_NEAREST_DISTANCE_THRESHOLD} from every
 *     anchor (e.g. instance maps, sea, unmapped territories).
 *
 * The DTO layer treats this as truly optional: the
 * `primaryLocation?` field is OMITTED (not `null`) when this
 * returns `null`.
 */
export function computePrimaryLocation(
  spawns: Spawn[],
  chronicle: Chronicle
): LocationRefDto | null {
  if (spawns.length === 0) return null;

  const counts = new Map<number, { zone: HuntingZone; count: number }>();
  for (const s of spawns) {
    const zone = resolveLocationForSpawn(chronicle, s);
    if (!zone) continue;
    const existing = counts.get(zone.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(zone.id, { zone, count: 1 });
    }
  }
  if (counts.size === 0) return null;

  let bestId = Number.POSITIVE_INFINITY;
  let bestCount = -1;
  let best: HuntingZone | null = null;
  for (const { zone, count } of counts.values()) {
    if (count > bestCount || (count === bestCount && zone.id < bestId)) {
      bestCount = count;
      bestId = zone.id;
      best = zone;
    }
  }
  return best ? toLocationRefDto(best) : null;
}

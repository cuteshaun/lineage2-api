import type { Chronicle } from "../../chronicles";
import type { Spawn } from "../../types";
import {
  resolveLocationForSpawn,
  resolveRegionForSpawn,
} from "../../data/indexes";
import { toRegionRefDto, type RegionRefDto } from "./region";
import { toLocationRefDto, type LocationRefDto } from "./location";

/**
 * Public shape for a single cleaned-layer spawn row, returned by
 * `GET /api/[chronicle]/npcs/[id]/spawns` (and its cleaned-monster
 * sibling — the cleaned monsters layer routes through the same
 * cleaned NPC accessor, so there is one shape, not two). Carries
 * every field of the underlying engine `Spawn` plus the resolved
 * `region`:
 *
 *   - `region: null` when the spawn coordinate falls outside the
 *     mapped tile grid (or the chronicle ships no `mapRegions.xml`).
 *   - `region: RegionRefDto` when the cell resolves cleanly.
 *
 * The field is always present (never omitted) so client typing is
 * predictable. There is no synthetic "Unknown" region — `null` is
 * the honest signal.
 *
 * Raw spawn endpoints (`/raw/monsters/[id]/spawns`) intentionally
 * return the unenriched `Spawn` shape. Per AGENTS.md "raw stays
 * close to engine truth", region resolution is a cleaned-layer
 * affordance only.
 */
export interface EnrichedSpawnDto {
  npcId: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  respawnDelay: number;
  respawnRandom: number;
  periodOfDay: number;
  region: RegionRefDto | null;
  /**
   * Player-facing location (M7) — nearest hunting-zone anchor from
   * `huntingzone-e.dat` within
   * {@link LOCATION_NEAREST_DISTANCE_THRESHOLD} 2D distance. Always
   * present; `null` when no anchor is close enough OR the chronicle
   * ships no `huntingzone-e.dat`. Complementary to `region` —
   * region is the engine death-teleport anchor (coarse), location
   * is the player-facing area name (finer).
   */
  location: LocationRefDto | null;
}

export function toEnrichedSpawnDto(
  spawn: Spawn,
  chronicle: Chronicle
): EnrichedSpawnDto {
  const region = resolveRegionForSpawn(chronicle, spawn);
  const zone = resolveLocationForSpawn(chronicle, spawn);
  return {
    npcId: spawn.npcId,
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    heading: spawn.heading,
    respawnDelay: spawn.respawnDelay,
    respawnRandom: spawn.respawnRandom,
    periodOfDay: spawn.periodOfDay,
    region: region ? toRegionRefDto(region) : null,
    location: zone ? toLocationRefDto(zone) : null,
  };
}

/**
 * Computes the **primary region** of an NPC from a list of its
 * cleaned spawns: the most frequent non-null region (mode by id),
 * with a stable lowest-id tiebreak. Returns `null` when:
 *
 *   - the NPC has no spawns at all, or
 *   - every spawn falls outside the mapped grid.
 *
 * This is what `NpcDetailDto.primaryRegion?` is populated from. The
 * field is omitted (truly optional) when this returns `null`,
 * because the player-facing detail page renders nothing for an
 * unknown primary region.
 */
export function computePrimaryRegion(
  spawns: Spawn[],
  chronicle: Chronicle
): RegionRefDto | null {
  if (spawns.length === 0) return null;

  const counts = new Map<number, { region: RegionRefDto; count: number }>();
  for (const s of spawns) {
    const region = resolveRegionForSpawn(chronicle, s);
    if (!region) continue;
    const existing = counts.get(region.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(region.id, { region: toRegionRefDto(region), count: 1 });
    }
  }
  if (counts.size === 0) return null;

  let bestId = Number.POSITIVE_INFINITY;
  let bestCount = -1;
  let best: RegionRefDto | null = null;
  for (const { region, count } of counts.values()) {
    if (count > bestCount || (count === bestCount && region.id < bestId)) {
      bestCount = count;
      bestId = region.id;
      best = region;
    }
  }
  return best;
}

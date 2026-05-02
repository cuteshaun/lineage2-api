import type { Region } from "../../types";

/**
 * Compact reference to a named L2 region (e.g.
 * `{ id: 0, name: "Talking Island Village" }`). Used by:
 *
 *   - `EnrichedSpawnDto.region` — the resolved region for a single
 *     spawn point.
 *   - `NpcDetailDto.primaryRegion?` — the most-frequent region across
 *     an NPC's spawns (mode by id; lowest-id tiebreak).
 *   - `GET /api/[chronicle]/regions` — the public catalog.
 *
 * The 19 region names come from the upstream `mapRegions.xml`'s
 * leading comment block. The numeric ids match the upstream engine's
 * region ids exactly, so consumers cross-referencing aCis docs see
 * the same numbers.
 *
 * **Important semantics**: aCis's `mapRegions.xml` represents
 * **engine "death-teleport" regions** — which town/village the
 * client teleports a player to when they die in that tile. It is
 * NOT a precise biome/zone polygon. Coordinates outside the mapped
 * tile grid resolve to `null`; there is no synthetic "Unknown"
 * region. Consumers should treat the field as "the in-game town
 * this NPC is associated with" rather than "the geographic biome
 * label". A finer-grained zone-polygon system (TownZone /
 * SiegeZone / WaterZone polygons) is a future milestone, not M4.
 */
export interface RegionRefDto {
  id: number;
  name: string;
}

export function toRegionRefDto(region: Region): RegionRefDto {
  return { id: region.id, name: region.name };
}

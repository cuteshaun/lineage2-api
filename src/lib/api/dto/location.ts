import type { Chronicle } from "../../chronicles";
import type { HuntingZone, Spawn } from "../../types";
import {
  getHuntingZoneById,
  resolveLocationForSpawn,
} from "../../data/indexes";

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
 * **Override carve-out (NPC / Monster detail only).** A small,
 * audit-justified set of NPCs route their public
 * `primaryLocation?` through a hardcoded override (e.g. Queen Ant
 * → *The Ant Nest*) when the nearest-2D-anchor rule would pick a
 * surface area over the dungeon the boss actually inhabits. The
 * override applies **only** to `toNpcDetailDto` (and therefore the
 * `/npcs/[id]` and `/monsters/[id]` responses); every other
 * surface — the locations catalog, enriched-spawn `location`, the
 * raw endpoints, quest detail's `primaryLocation?` — uses the
 * unmodified resolver. See `PRIMARY_LOCATION_OVERRIDES_BY_NPC_ID`
 * in this file for the current entries and the audit policy.
 *
 * **Name normalization.** `name` is whitespace-normalized at the
 * public DTO boundary — leading/trailing spaces are trimmed and
 * runs of internal whitespace collapsed to a single space. The
 * generated `huntingzones.json` artifact preserves the source
 * spelling verbatim; raw endpoints surface those names as-is.
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
  /**
   * Player-facing name. Whitespace-normalized at the DTO boundary
   * (trim + collapse internal runs to a single space) — see the
   * type-level docstring for the rationale and the
   * raw-vs-public split.
   */
  name: string;
  /**
   * Recommended minimum player level. `null` when the source
   * carries no level signal (e.g. towns and non-combat areas
   * have `0` in the DAT, surfaced as `null` here for predictable
   * client typing).
   */
  minLevel: number | null;
}

/**
 * Public-DTO whitespace normalization for hunting-zone names. The
 * raw DAT carries a handful of typographic glitches —
 * trailing/leading spaces (`"Antharas' Lair "`, `"Abandoned Camp "`,
 * `"Timak Outpost "`, `"Forsaken Plains "`) and one double internal
 * space (`"Town  of Goddard"`). We do **not** rewrite the generated
 * `huntingzones.json` (raw stays close to source — see AGENTS.md);
 * normalization is applied at the public DTO boundary so every
 * surface that emits a `LocationRefDto` (catalog, enriched spawn,
 * primary-location cross-links) sees clean names.
 */
function normalizeLocationName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function toLocationRefDto(zone: HuntingZone): LocationRefDto {
  return {
    id: zone.id,
    name: normalizeLocationName(zone.name),
    minLevel: zone.minLevel > 0 ? zone.minLevel : null,
  };
}

/**
 * Narrow override map for known nearest-anchor heuristic failures
 * on NPC / Monster detail. Applied **only** to the public
 * `primaryLocation?` derivation in `toNpcDetailDto` — every other
 * surface (raw endpoints, the locations catalog, enriched-spawn
 * DTO, quest detail) goes through the unmodified resolver.
 *
 * Each entry is a verified case where the 2D nearest-anchor rule
 * picks a misleading surface area over the dungeon the boss
 * actually inhabits, because the dungeon's center anchor sits at
 * the entrance (often >10000 units from the deepest spawn) while
 * a surface anchor lands closer in 2D. Source data is correct;
 * the heuristic is the limitation.
 *
 * **Current entries:**
 *   - `29001` Queen Ant → zone `34` *The Ant Nest*. Nearest 2D
 *     resolver picks Wasteland (8845 units, surface above the
 *     dungeon entrance) over The Ant Nest (12846 units, just
 *     outside the 10000-unit threshold).
 *
 * Adding new entries requires audit evidence (anchor distances,
 * proof the resolver mis-resolves, link to the docs). Do not
 * grow this map opportunistically.
 */
const PRIMARY_LOCATION_OVERRIDES_BY_NPC_ID = new Map<number, number>([
  [29001, 34], // Queen Ant → The Ant Nest
]);

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

/**
 * NPC-scoped wrapper around {@link computePrimaryLocation} that
 * applies the {@link PRIMARY_LOCATION_OVERRIDES_BY_NPC_ID} map for
 * known nearest-anchor heuristic failures. When `npcId` has an
 * override, the mapped hunting-zone is returned (with the same
 * normalized-name `LocationRefDto` shape). Otherwise the standard
 * mode-of-spawns rule applies. Used **only** by `toNpcDetailDto` —
 * other consumers (enriched spawn, quest detail, catalog) call
 * the unwrapped resolver / `computePrimaryLocation` directly.
 */
export function resolvePrimaryLocationForNpc(
  npcId: number,
  spawns: Spawn[],
  chronicle: Chronicle
): LocationRefDto | null {
  const overrideZoneId = PRIMARY_LOCATION_OVERRIDES_BY_NPC_ID.get(npcId);
  if (overrideZoneId !== undefined) {
    const zone = getHuntingZoneById(chronicle, overrideZoneId);
    if (zone) return toLocationRefDto(zone);
    // Fall through if the chronicle has no zones (or the override
    // id has been retired) — a missing override is silent rather
    // than throwing. The standard resolver still runs below.
  }
  return computePrimaryLocation(spawns, chronicle);
}

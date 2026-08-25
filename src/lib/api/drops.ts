import {
  getDropsByNpcId,
  getItemById,
  getMonsterById,
  getNpcById,
} from "@/lib/data/indexes";
import type { Chronicle } from "@/lib/chronicles";
import { toNpcDropsDto } from "@/lib/api/dto/drops";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

export type DropType = "spoil" | "adena" | "regular";

export interface EnrichedDrop {
  itemId: number;
  itemName: string | null;
  min: number | null;
  max: number | null;
  chance: number | null;
  category: number | null;
  type: DropType;
}

export interface EnrichedNpcDrops {
  npcId: number;
  npcName: string;
  drops: EnrichedDrop[];
}

function categoryType(categoryId: number | null): DropType {
  if (categoryId === -1) return "spoil";
  if (categoryId === 0) return "adena";
  return "regular";
}

/**
 * Look up a cleaned NPC's drops and join each entry with the item name from
 * the items index. Accepts either the canonical id or any merged raw id —
 * both resolve to the same cleaned drop set (union across mergedIds, deduped).
 * Returns `null` if the NPC has no drop table at all — the route handler
 * ({@link handleNpcDropsRequest}) turns that into an empty `drops: []` for an
 * NPC that exists, and only 404s when the NPC itself is unknown.
 */
export function getEnrichedNpcDrops(
  chronicle: Chronicle,
  npcId: number
): EnrichedNpcDrops | null {
  const npcDrops = getDropsByNpcId(chronicle, npcId);
  if (!npcDrops) return null;

  const drops: EnrichedDrop[] = [];
  for (const cat of npcDrops.categories) {
    const type = categoryType(cat.categoryId);
    for (const drop of cat.drops) {
      const item = getItemById(chronicle, drop.itemId);
      drops.push({
        itemId: drop.itemId,
        itemName: item?.name ?? null,
        min: drop.min,
        max: drop.max,
        chance: drop.chance,
        category: cat.categoryId,
        type,
      });
    }
  }

  return {
    npcId: npcDrops.npcId,
    npcName: npcDrops.npcName,
    drops,
  };
}

export interface NpcDropsRouteOptions {
  /**
   * When `true`, the id must resolve to a monster (see `MONSTER_NPC_TYPES`
   * via {@link getMonsterById}); non-monster NPC ids return 404 so the
   * route mirrors the gate applied by `/monsters/[id]`.
   */
  requireMonster?: boolean;
}

/**
 * Shared GET handler for every "drops of one NPC" route:
 *   - `/api/[chronicle]/npcs/[id]/drops`
 *   - `/api/[chronicle]/drops/npc/[id]` (alias)
 *   - `/api/[chronicle]/monsters/[id]/drops` (`requireMonster: true`)
 *
 * All three return the same `NpcDropsDto` shape. Route files stay thin so
 * the alias and the monster variant can never drift from the canonical route.
 *
 * Existence contract (shared with `/items/[id]/dropped-by` etc.):
 *   - parent NPC/monster does not exist → 404
 *   - parent exists but has no drop table → 200 with `drops: []`
 */
export async function handleNpcDropsRequest(
  params: Promise<{ chronicle: string; id: string }>,
  options: NpcDropsRouteOptions = {}
): Promise<Response> {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const npc = options.requireMonster
    ? getMonsterById(parsed.chronicle, parsed.id)
    : getNpcById(parsed.chronicle, parsed.id);
  if (!npc) {
    const noun = options.requireMonster ? "Monster" : "NPC";
    return jsonError(`${noun} ${parsed.id} not found`, 404);
  }

  const enriched = getEnrichedNpcDrops(parsed.chronicle, parsed.id) ?? {
    npcId: npc.id,
    npcName: npc.name,
    drops: [],
  };

  return jsonOk(toNpcDropsDto(enriched));
}

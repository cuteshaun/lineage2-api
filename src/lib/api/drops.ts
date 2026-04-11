import { getDropsByNpcId, getItemById } from "@/lib/data/indexes";
import type { Chronicle } from "@/lib/chronicles";

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
 * Look up an NPC's drops and join each entry with the item name from the
 * items index. Returns `null` if the NPC has no drops table.
 *
 * Used by both `/api/[chronicle]/drops/npc/[id]` and the REST-style alias
 * `/api/[chronicle]/npcs/[id]/drops`.
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

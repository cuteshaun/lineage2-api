import type { Chronicle } from "../../chronicles";
import type { Multisell } from "../../types";
import {
  getBuyListsByNpcId,
  getItemById,
  getMultisellsByNpcId,
  getRawNpcById,
} from "../../data/indexes";
import type {
  ExchangeOptionDto,
  ItemQuantityDto,
  NpcRefDto,
  ShopProductDto,
} from "./item";

/**
 * Public response shape for `GET /api/[chronicle]/npcs/[id]/shop`.
 *
 * `buyList` and `exchanges` are both optional — omitted (not empty
 * arrays) when the NPC has none of that kind. The response is built
 * by {@link buildShopResponse}; both the route handler and the
 * snapshot test consume the same builder so a route-shape drift
 * surfaces as a snapshot diff.
 */
export interface ShopResponseDto {
  npc: NpcRefDto;
  buyList?: ShopProductDto[];
  exchanges?: ExchangeOptionDto[];
}

/**
 * Build the shop response for a given NPC. Returns `null` when the
 * NPC id doesn't resolve — callers translate this to a 404 (route
 * handler) or fail the assertion (snapshot test).
 */
export function buildShopResponse(
  chronicle: Chronicle,
  npcId: number
): ShopResponseDto | null {
  const npc = getRawNpcById(chronicle, npcId);
  if (!npc) return null;

  const products: ShopProductDto[] = [];
  for (const buyList of getBuyListsByNpcId(chronicle, npcId)) {
    for (const p of buyList.products) {
      const item = getItemById(chronicle, p.itemId);
      products.push({
        itemId: p.itemId,
        name: item?.name ?? `#${p.itemId}`,
        iconFile: item?.iconFile ?? null,
        price: p.price,
        buyListId: buyList.id,
      });
    }
  }
  // Stable order: by price ascending then item id.
  products.sort((a, b) => a.price - b.price || a.itemId - b.itemId);

  const exchanges: ExchangeOptionDto[] = [];
  for (const ms of getMultisellsByNpcId(chronicle, npcId)) {
    for (let i = 0; i < ms.entries.length; i++) {
      const dto = renderExchange(chronicle, ms, i);
      if (dto) exchanges.push(dto);
    }
  }

  return {
    npc: { id: npc.id, name: npc.name },
    buyList: products.length > 0 ? products : undefined,
    exchanges: exchanges.length > 0 ? exchanges : undefined,
  };
}

function renderExchange(
  chronicle: Chronicle,
  multisell: Multisell,
  entryIndex: number
): ExchangeOptionDto | null {
  const entry = multisell.entries[entryIndex];
  const npcs: NpcRefDto[] = [];
  for (const id of multisell.npcIds) {
    const n = getRawNpcById(chronicle, id);
    if (n) npcs.push({ id: n.id, name: n.name });
  }
  if (npcs.length === 0) return null;

  return {
    multisellId: multisell.id,
    maintainEnchantment: multisell.maintainEnchantment,
    npcs,
    required: entry.ingredients.map(
      (ing): ItemQuantityDto => {
        const item = getItemById(chronicle, ing.itemId);
        return {
          itemId: ing.itemId,
          name: item?.name ?? `#${ing.itemId}`,
          iconFile: item?.iconFile ?? null,
          count: ing.count,
        };
      }
    ),
    produces: ((): ItemQuantityDto => {
      const item = getItemById(chronicle, entry.production.itemId);
      return {
        itemId: entry.production.itemId,
        name: item?.name ?? `#${entry.production.itemId}`,
        iconFile: item?.iconFile ?? null,
        count: entry.production.count,
      };
    })(),
  };
}

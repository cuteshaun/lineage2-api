import { expect, test } from "vitest";
import {
  getBuyListsByNpcId,
  getItemById,
  getMultisellsByNpcId,
  getRawNpcById,
} from "@/lib/data/indexes";
import type {
  ExchangeOptionDto,
  ItemQuantityDto,
  NpcRefDto,
  ShopProductDto,
} from "@/lib/api/dto/item";

/**
 * Locks the public response shape of `GET /api/[chronicle]/npcs/[id]/shop`.
 * Each fixture is built using the same accessors the route handler
 * uses, so a parser change, DTO change, or sort-order drift surfaces
 * here.
 *
 * Fixtures:
 *  - **Lector (30001)** — buyList-only NPC. Locks `ShopProductDto[]`
 *    sort and the multi-buyList aggregation (Lector has 2 buyLists,
 *    products merged into one sorted list).
 *  - **Pinter (30298)** — exchange-only Town Blacksmith. Locks
 *    multi-NPC `npcs[]` plural (Pinter is one of 14 blacksmiths in
 *    multisells 1002 + 1003).
 */
function buildShopResponse(npcId: number) {
  const npc = getRawNpcById("interlude", npcId);
  if (!npc) throw new Error(`NPC ${npcId} not found`);

  const products: ShopProductDto[] = [];
  for (const buyList of getBuyListsByNpcId("interlude", npcId)) {
    for (const p of buyList.products) {
      const item = getItemById("interlude", p.itemId);
      products.push({
        itemId: p.itemId,
        name: item?.name ?? `#${p.itemId}`,
        iconFile: item?.iconFile ?? null,
        price: p.price,
        buyListId: buyList.id,
      });
    }
  }
  products.sort((a, b) => a.price - b.price || a.itemId - b.itemId);

  const exchanges: ExchangeOptionDto[] = [];
  for (const ms of getMultisellsByNpcId("interlude", npcId)) {
    for (let i = 0; i < ms.entries.length; i++) {
      const npcs: NpcRefDto[] = [];
      for (const id of ms.npcIds) {
        const n = getRawNpcById("interlude", id);
        if (n) npcs.push({ id: n.id, name: n.name });
      }
      if (npcs.length === 0) continue;

      const entry = ms.entries[i];
      exchanges.push({
        multisellId: ms.id,
        maintainEnchantment: ms.maintainEnchantment,
        npcs,
        required: entry.ingredients.map(
          (ing): ItemQuantityDto => {
            const item = getItemById("interlude", ing.itemId);
            return {
              itemId: ing.itemId,
              name: item?.name ?? `#${ing.itemId}`,
              iconFile: item?.iconFile ?? null,
              count: ing.count,
            };
          }
        ),
        produces: ((): ItemQuantityDto => {
          const item = getItemById("interlude", entry.production.itemId);
          return {
            itemId: entry.production.itemId,
            name: item?.name ?? `#${entry.production.itemId}`,
            iconFile: item?.iconFile ?? null,
            count: entry.production.count,
          };
        })(),
      });
    }
  }

  return {
    npc: { id: npc.id, name: npc.name } satisfies NpcRefDto,
    buyList: products.length > 0 ? products : undefined,
    exchanges: exchanges.length > 0 ? exchanges : undefined,
  };
}

test("NPC shop — Lector (30001), buyList-only", () => {
  expect(buildShopResponse(30001)).toMatchSnapshot();
});

test("NPC shop — Pinter (30298), exchange-only blacksmith", () => {
  expect(buildShopResponse(30298)).toMatchSnapshot();
});

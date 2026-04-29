import {
  getBuyListsByNpcId,
  getItemById,
  getMultisellsByNpcId,
  getRawNpcById,
} from "@/lib/data/indexes";
import {
  jsonError,
  jsonOk,
  parseEntityParams,
} from "@/lib/api/responses";
import type { Chronicle } from "@/lib/chronicles";
import type { Multisell } from "@/lib/types";
import type {
  ExchangeOptionDto,
  ItemQuantityDto,
  NpcRefDto,
  ShopProductDto,
} from "@/lib/api/dto/item";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const npc = getRawNpcById(parsed.chronicle, parsed.id);
  if (!npc) {
    return jsonError(`NPC ${parsed.id} not found`, 404);
  }

  const buyLists = getBuyListsByNpcId(parsed.chronicle, parsed.id);
  const products: ShopProductDto[] = [];
  for (const buyList of buyLists) {
    for (const p of buyList.products) {
      const item = getItemById(parsed.chronicle, p.itemId);
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

  const multisells = getMultisellsByNpcId(parsed.chronicle, parsed.id);
  const exchanges: ExchangeOptionDto[] = [];
  for (const ms of multisells) {
    for (let i = 0; i < ms.entries.length; i++) {
      const dto = renderExchange(parsed.chronicle, ms, i);
      if (dto) exchanges.push(dto);
    }
  }

  return jsonOk({
    npc: { id: npc.id, name: npc.name } satisfies NpcRefDto,
    buyList: products.length > 0 ? products : undefined,
    exchanges: exchanges.length > 0 ? exchanges : undefined,
  });
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

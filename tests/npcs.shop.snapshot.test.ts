import { expect, test } from "vitest";
import { buildShopResponse } from "@/lib/api/dto/shop";

/**
 * Locks the public response shape of `GET /api/[chronicle]/npcs/[id]/shop`.
 * Both the route handler and these tests call the same
 * `buildShopResponse` from `src/lib/api/dto/shop.ts`, so a parser
 * change, DTO change, or sort-order drift in the route surfaces
 * here as a snapshot diff.
 *
 * Fixtures:
 *  - **Lector (30001)** — buyList-only NPC. Locks `ShopProductDto[]`
 *    sort and the multi-buyList aggregation (Lector has 2 buyLists,
 *    products merged into one sorted list).
 *  - **Pinter (30298)** — exchange-only Town Blacksmith. Locks
 *    multi-NPC `npcs[]` plural (Pinter is one of 14 blacksmiths in
 *    multisells 1002 + 1003).
 */
function shopFor(npcId: number) {
  const response = buildShopResponse("interlude", npcId);
  if (!response) throw new Error(`NPC ${npcId} not found`);
  return response;
}

test("NPC shop — Lector (30001), buyList-only", () => {
  expect(shopFor(30001)).toMatchSnapshot();
});

test("NPC shop — Pinter (30298), exchange-only blacksmith", () => {
  expect(shopFor(30298)).toMatchSnapshot();
});

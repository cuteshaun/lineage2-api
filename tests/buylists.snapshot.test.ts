import { expect, test } from "vitest";
import { getBuyListsByNpcId } from "@/lib/data/indexes";

/**
 * Lock the parsed buyList records (raw, not DTO-resolved) for one
 * representative merchant. Any change to the parser, the npcId="-1"
 * sentinel filter, or the source XML drops a snapshot diff here.
 *
 * Lector (id 30001) is a Talking Island grocer with 2 buyLists; small
 * enough to eyeball the snapshot but exercises the multi-buyList
 * shape (one NPC offering several inventory categories).
 */
test("buyLists for Lector (30001) match snapshot", () => {
  const lists = getBuyListsByNpcId("interlude", 30001);
  expect(lists).toMatchSnapshot();
});

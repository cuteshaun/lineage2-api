import { expect, test } from "vitest";
import { GET as listGET } from "@/app/api/[chronicle]/monsters/route";
import { GET as detailGET } from "@/app/api/[chronicle]/monsters/[id]/route";
import { GET as monsterDropsGET } from "@/app/api/[chronicle]/monsters/[id]/drops/route";
import { GET as npcDropsGET } from "@/app/api/[chronicle]/npcs/[id]/drops/route";

/**
 * Locks `GET /api/[chronicle]/monsters` (cleaned monster list,
 * `npcType` already restricted to the monster subset) and the
 * companion `GET /api/[chronicle]/monsters/[id]` detail endpoint.
 *
 * Detail fixtures:
 *   - Grim Wolf (22001) — landing-page reference, stable ordinary
 *     monster. Locks the default `primaryLocation` derivation
 *     (mode-of-spawns nearest-anchor).
 *   - Queen Ant (29001) — locks the `primaryLocation`
 *     override carve-out (NPC-id-keyed map; resolves to
 *     *The Ant Nest* even though the 2D nearest-anchor rule
 *     would pick *Wasteland*). See
 *     `PRIMARY_LOCATION_OVERRIDES_BY_NPC_ID` in
 *     `src/lib/api/dto/location.ts`.
 */
async function callList(search: string) {
  const response = await listGET(
    new Request(`http://test/api/interlude/monsters${search}`),
    { params: Promise.resolve({ chronicle: "interlude" }) }
  );
  return { status: response.status, body: await response.json() };
}

async function callDetail(id: number) {
  const response = await detailGET(
    new Request(`http://test/api/interlude/monsters/${id}`),
    { params: Promise.resolve({ chronicle: "interlude", id: String(id) }) }
  );
  return { status: response.status, body: await response.json() };
}

test("monsters list — default sort, limit=5", async () => {
  expect(await callList("?limit=5")).toMatchSnapshot();
});

test("monsters list — sort=-level, limit=5", async () => {
  expect(await callList("?limit=5&sort=-level")).toMatchSnapshot();
});

test("monsters detail — Grim Wolf (22001)", async () => {
  expect(await callDetail(22001)).toMatchSnapshot();
});

test("monsters detail — Queen Ant (29001), primaryLocation override", async () => {
  expect(await callDetail(29001)).toMatchSnapshot();
});

test("monsters detail — invalid id returns 404", async () => {
  expect(await callDetail(999999)).toMatchSnapshot();
});

/**
 * `GET /api/[chronicle]/monsters/[id]/drops` — same `NpcDropsDto` shape as
 * `/npcs/[id]/drops`, gated to the monster subset.
 */
async function callMonsterDrops(id: number) {
  const response = await monsterDropsGET(
    new Request(`http://test/api/interlude/monsters/${id}/drops`),
    { params: Promise.resolve({ chronicle: "interlude", id: String(id) }) }
  );
  return { status: response.status, body: await response.json() };
}

async function callNpcDrops(id: number) {
  const response = await npcDropsGET(
    new Request(`http://test/api/interlude/npcs/${id}/drops`),
    { params: Promise.resolve({ chronicle: "interlude", id: String(id) }) }
  );
  return { status: response.status, body: await response.json() };
}

test("monster drops — Grim Wolf (22001)", async () => {
  expect(await callMonsterDrops(22001)).toMatchSnapshot();
});

test("monster drops — identical to /npcs/{id}/drops for a monster", async () => {
  const monster = await callMonsterDrops(22001);
  const npc = await callNpcDrops(22001);
  expect(monster.status).toBe(200);
  expect(monster).toEqual(npc);
});

test("monster drops — non-monster NPC (Darin, 30048) returns 404", async () => {
  const result = await callMonsterDrops(30048);
  expect(result.status).toBe(404);
  // Same gate as `/monsters/[id]`: the non-monster 404 comes before any
  // drop-table lookup.
  expect(result.body).toEqual((await callDetail(30048)).body);
  expect(result).toMatchSnapshot();
});

test("monster drops — invalid id returns 404", async () => {
  expect(await callMonsterDrops(999999)).toMatchSnapshot();
});

import { expect, test } from "vitest";
import { GET as listGET } from "@/app/api/[chronicle]/monsters/route";
import { GET as detailGET } from "@/app/api/[chronicle]/monsters/[id]/route";

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

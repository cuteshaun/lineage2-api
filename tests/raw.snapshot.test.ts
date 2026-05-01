import { expect, test } from "vitest";
import { GET as rawNpcsListGET } from "@/app/api/[chronicle]/raw/npcs/route";
import { GET as rawNpcDetailGET } from "@/app/api/[chronicle]/raw/npcs/[id]/route";
import { GET as rawMonstersListGET } from "@/app/api/[chronicle]/raw/monsters/route";
import { GET as rawMonsterDetailGET } from "@/app/api/[chronicle]/raw/monsters/[id]/route";
import { GET as rawMonsterSpawnsGET } from "@/app/api/[chronicle]/raw/monsters/[id]/spawns/route";

/**
 * Locks the raw NPC/monster surface — `/api/[chronicle]/raw/...`.
 *
 * Raw endpoints are source-faithful: every raw row, no name dedup,
 * no DTO mapping. This test suite ensures that "raw stays raw" —
 * a parser change that adds or removes `Npc` fields surfaces here
 * directly. Picked Grim Wolf (22001) again as the cross-cutting
 * fixture (also covered by cleaned-monster + drops/spawns tests),
 * which lets us verify raw-vs-cleaned divergence in one place.
 */
async function callList<T>(
  GET: (req: Request, ctx: { params: Promise<{ chronicle: string }> }) => Promise<Response>,
  path: string,
  search: string
) {
  const response = await GET(
    new Request(`http://test/api/interlude/raw/${path}${search}`),
    { params: Promise.resolve({ chronicle: "interlude" }) }
  );
  return { status: response.status, body: await response.json() };
}

async function callDetail<T>(
  GET: (req: Request, ctx: { params: Promise<{ chronicle: string; id: string }> }) => Promise<Response>,
  path: string,
  id: number
) {
  const response = await GET(
    new Request(`http://test/api/interlude/raw/${path}/${id}`),
    { params: Promise.resolve({ chronicle: "interlude", id: String(id) }) }
  );
  return { status: response.status, body: await response.json() };
}

test("raw npcs list — limit=5", async () => {
  expect(await callList(rawNpcsListGET, "npcs", "?limit=5")).toMatchSnapshot();
});

test("raw npcs detail — Darin (30048)", async () => {
  expect(await callDetail(rawNpcDetailGET, "npcs", 30048)).toMatchSnapshot();
});

test("raw monsters list — sort=-level, limit=5", async () => {
  expect(await callList(rawMonstersListGET, "monsters", "?limit=5&sort=-level")).toMatchSnapshot();
});

test("raw monsters detail — Grim Wolf (22001)", async () => {
  expect(await callDetail(rawMonsterDetailGET, "monsters", 22001)).toMatchSnapshot();
});

test("raw monsters spawns — Grim Wolf (22001)", async () => {
  expect(await callDetail(rawMonsterSpawnsGET, "monsters", 22001)).toMatchSnapshot();
});

test("raw monsters detail — non-monster id returns 404", async () => {
  // 30048 is Darin (Folk), not a monster — raw monsters route gates on monster type.
  expect(await callDetail(rawMonsterDetailGET, "monsters", 30048)).toMatchSnapshot();
});

import { expect, test } from "vitest";
import { GET } from "@/app/api/[chronicle]/npcs/route";

/**
 * Locks `GET /api/[chronicle]/npcs` (cleaned NPC list — one record
 * per unique name). Three fixtures: default sort, npcType filter,
 * and a level-range filter with `sort=-level` to exercise
 * descending sort. `limit=5` keeps each snapshot small.
 */
async function call(search: string) {
  const response = await GET(
    new Request(`http://test/api/interlude/npcs${search}`),
    { params: Promise.resolve({ chronicle: "interlude" }) }
  );
  return { status: response.status, body: await response.json() };
}

test("npcs list — default sort, limit=5", async () => {
  expect(await call("?limit=5")).toMatchSnapshot();
});

test("npcs list — npcType=RaidBoss sort=-level, limit=5", async () => {
  expect(await call("?limit=5&npcType=RaidBoss&sort=-level")).toMatchSnapshot();
});

test("npcs list — levelMin=60&levelMax=65 sort=level, limit=5", async () => {
  expect(await call("?limit=5&levelMin=60&levelMax=65&sort=level")).toMatchSnapshot();
});

test("npcs list — invalid range (levelMin > levelMax) returns 400", async () => {
  expect(await call("?levelMin=80&levelMax=10")).toMatchSnapshot();
});

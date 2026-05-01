import { expect, test } from "vitest";
import { GET as listGET } from "@/app/api/[chronicle]/monsters/route";
import { GET as detailGET } from "@/app/api/[chronicle]/monsters/[id]/route";

/**
 * Locks `GET /api/[chronicle]/monsters` (cleaned monster list,
 * `npcType` already restricted to the monster subset) and the
 * companion `GET /api/[chronicle]/monsters/[id]` detail endpoint.
 *
 * Detail fixture: Grim Wolf (22001) — referenced by the landing
 * page (`src/app/page.tsx`) so it's a stable, well-known fixture.
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

test("monsters detail — invalid id returns 404", async () => {
  expect(await callDetail(999999)).toMatchSnapshot();
});

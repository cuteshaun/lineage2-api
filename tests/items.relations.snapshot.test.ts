import { expect, test } from "vitest";
import { GET as droppedGET } from "@/app/api/[chronicle]/items/[id]/dropped-by/route";
import { GET as spoiledGET } from "@/app/api/[chronicle]/items/[id]/spoiled-by/route";

/**
 * Locks the public response shape of `dropped-by` and `spoiled-by`
 * cross-link endpoints. Fixtures pick items with **non-empty,
 * manageable** source lists so the snapshot exercises the actual
 * DTO mapper rather than locking a `total: 0` empty case:
 *
 *  - **dropped-by Emergency Dressing (1834)** — 10 NPC sources;
 *    `limit=5` exercises pagination first-page.
 *  - **dropped-by Small Shield (19)** — 4 NPC sources; full list
 *    fits on one page (locks the small-set shape).
 *  - **spoiled-by Theca Leather Armor Pattern (1984)** — 8 spoil
 *    sources; `limit=5` again exercises pagination.
 *
 * The tests run the actual route handlers including
 * `parseEntityParams`, pagination defaults, and the
 * `toItemSourcesPageDto` mapper.
 */
async function callDropped(id: number, search = "") {
  const response = await droppedGET(
    new Request(`http://test/api/interlude/items/${id}/dropped-by${search}`),
    { params: Promise.resolve({ chronicle: "interlude", id: String(id) }) }
  );
  return { status: response.status, body: await response.json() };
}

async function callSpoiled(id: number, search = "") {
  const response = await spoiledGET(
    new Request(`http://test/api/interlude/items/${id}/spoiled-by${search}`),
    { params: Promise.resolve({ chronicle: "interlude", id: String(id) }) }
  );
  return { status: response.status, body: await response.json() };
}

test("dropped-by — Emergency Dressing (1834), limit=5", async () => {
  expect(await callDropped(1834, "?limit=5")).toMatchSnapshot();
});

test("dropped-by — Small Shield (19), full small list", async () => {
  expect(await callDropped(19, "?limit=10")).toMatchSnapshot();
});

test("spoiled-by — Theca Leather Armor Pattern (1984), limit=5", async () => {
  expect(await callSpoiled(1984, "?limit=5")).toMatchSnapshot();
});

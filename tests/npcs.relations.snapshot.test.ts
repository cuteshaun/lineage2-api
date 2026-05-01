import { expect, test } from "vitest";
import { GET as dropsGET } from "@/app/api/[chronicle]/npcs/[id]/drops/route";
import { GET as spawnsGET } from "@/app/api/[chronicle]/npcs/[id]/spawns/route";

/**
 * Locks `GET /api/[chronicle]/npcs/[id]/drops` (enriched drop
 * table with item refs) and `GET /api/[chronicle]/npcs/[id]/spawns`
 * (raw spawn rows).
 *
 * Fixtures:
 *  - **Grim Wolf (22001)** — 10 drop entries + 8 spawn rows.
 *    Lvl 25, well-known monster cited by `src/app/page.tsx`.
 *    Locks the multi-spawn list shape and the drops categorization.
 *  - **Darin (30048)** — 1 spawn row, Talking Island.
 *    Locks the single-spawn shape and serves as a non-monster NPC
 *    spawn fixture (Darin is a Folk NPC, not a monster).
 */
async function callDrops(id: number) {
  const response = await dropsGET(
    new Request(`http://test/api/interlude/npcs/${id}/drops`),
    { params: Promise.resolve({ chronicle: "interlude", id: String(id) }) }
  );
  return { status: response.status, body: await response.json() };
}

async function callSpawns(id: number) {
  const response = await spawnsGET(
    new Request(`http://test/api/interlude/npcs/${id}/spawns`),
    { params: Promise.resolve({ chronicle: "interlude", id: String(id) }) }
  );
  return { status: response.status, body: await response.json() };
}

test("npc drops — Grim Wolf (22001)", async () => {
  expect(await callDrops(22001)).toMatchSnapshot();
});

test("npc drops — invalid id returns 404", async () => {
  expect(await callDrops(999999)).toMatchSnapshot();
});

test("npc spawns — Grim Wolf (22001), 8 spawns", async () => {
  expect(await callSpawns(22001)).toMatchSnapshot();
});

test("npc spawns — Darin (30048), single spawn", async () => {
  expect(await callSpawns(30048)).toMatchSnapshot();
});

test("npc spawns — invalid id returns 404", async () => {
  expect(await callSpawns(999999)).toMatchSnapshot();
});

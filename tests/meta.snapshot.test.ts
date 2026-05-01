import { expect, test } from "vitest";
import { GET as itemGradesGET } from "@/app/api/[chronicle]/meta/item-grades/route";
import { GET as itemTypesGET } from "@/app/api/[chronicle]/meta/item-types/route";
import { GET as npcTypesGET } from "@/app/api/[chronicle]/meta/npc-types/route";

/**
 * Locks the three `meta/*` routes used by UI clients to populate
 * filter dropdowns. Each response is a small fixed payload —
 * snapshotting the full response is the right grain (no
 * pagination, no fixture-id selection, just the entire shape).
 *
 * A new entity type appearing in the dataset (e.g. a new
 * `npcType` from a parser change) surfaces here directly.
 */
async function call(
  GET: (req: Request, ctx: { params: Promise<{ chronicle: string }> }) => Promise<Response>,
  path: string
) {
  const response = await GET(
    new Request(`http://test/api/interlude/meta/${path}`),
    { params: Promise.resolve({ chronicle: "interlude" }) }
  );
  return { status: response.status, body: await response.json() };
}

test("meta/item-grades", async () => {
  expect(await call(itemGradesGET, "item-grades")).toMatchSnapshot();
});

test("meta/item-types", async () => {
  expect(await call(itemTypesGET, "item-types")).toMatchSnapshot();
});

test("meta/npc-types", async () => {
  expect(await call(npcTypesGET, "npc-types")).toMatchSnapshot();
});

import { expect, test } from "vitest";
import { GET as listGet } from "@/app/api/[chronicle]/hennas/route";
import { GET as detailGet } from "@/app/api/[chronicle]/hennas/[id]/route";

/**
 * M8 lockdown:
 *
 *   - `GET /api/[chronicle]/hennas` returns the full 180-symbol
 *     catalog. 171 carry display fields from the L2 client DAT;
 *     9 (the +/- 4 "Greater II" tier) honestly emit
 *     `displayName/iconFile/shortLabel = null`.
 *   - `GET /api/[chronicle]/hennas/[id]` adds the resolved
 *     `allowedClasses: ClassRefDto[]` to the summary fields.
 *
 * Detail fixtures span the cardinal cases:
 *
 *   - `symbolId=1`  → first base-tier henna; broad fighter class
 *                     allow-list; full DAT display data.
 *   - `symbolId=7`  → Mystic-only (`Int+1 Men-3`), narrow class list.
 *   - `symbolId=37` → first "Greater" tier — same display pattern,
 *                     larger class list.
 *   - `symbolId=171`→ last symbol with clean DAT display.
 *   - `symbolId=172`→ first symbol with `displayName: null` etc.
 *                     (Greater II tier, mechanics-only fallback).
 *   - `symbolId=180`→ last symbol; Greater II tier nullable.
 */
async function callList() {
  const response = await listGet(
    new Request("http://test/api/interlude/hennas"),
    { params: Promise.resolve({ chronicle: "interlude" }) }
  );
  return { status: response.status, body: await response.json() };
}

async function callDetail(symbolId: number) {
  const response = await detailGet(
    new Request(`http://test/api/interlude/hennas/${symbolId}`),
    {
      params: Promise.resolve({
        chronicle: "interlude",
        id: String(symbolId),
      }),
    }
  );
  return { status: response.status, body: await response.json() };
}

test("hennas catalog (Interlude, 180 symbols)", async () => {
  expect(await callList()).toMatchSnapshot();
});

test("henna detail — symbolId=1 (Symbol of Strength, broad fighter list)", async () => {
  expect(await callDetail(1)).toMatchSnapshot();
});

test("henna detail — symbolId=7 (Mystic-only Int+1 Men-3)", async () => {
  expect(await callDetail(7)).toMatchSnapshot();
});

test("henna detail — symbolId=37 (Greater tier)", async () => {
  expect(await callDetail(37)).toMatchSnapshot();
});

test("henna detail — symbolId=171 (last with clean DAT display)", async () => {
  expect(await callDetail(171)).toMatchSnapshot();
});

test("henna detail — symbolId=172 (first Greater II, displayName/icon null)", async () => {
  expect(await callDetail(172)).toMatchSnapshot();
});

test("henna detail — symbolId=180 (last Greater II, mechanics-only)", async () => {
  expect(await callDetail(180)).toMatchSnapshot();
});

test("henna detail — symbolId=999 returns 404", async () => {
  const result = await callDetail(999);
  expect(result.status).toBe(404);
});

test("henna detail — invalid symbolId returns 400", async () => {
  const response = await detailGet(
    new Request("http://test/api/interlude/hennas/abc"),
    {
      params: Promise.resolve({ chronicle: "interlude", id: "abc" }),
    }
  );
  expect(response.status).toBe(400);
});

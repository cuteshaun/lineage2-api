import { expect, test } from "vitest";
import { GET } from "@/app/api/[chronicle]/regions/route";

/**
 * Locks `GET /api/[chronicle]/regions` — the public catalog of map
 * regions for the chronicle. Single fixture: full payload (19
 * regions for Interlude). No pagination params, no filters; the
 * payload is small and stable.
 */
async function call() {
  const response = await GET(
    new Request("http://test/api/interlude/regions"),
    { params: Promise.resolve({ chronicle: "interlude" }) }
  );
  return { status: response.status, body: await response.json() };
}

test("regions catalog (Interlude, 19 regions)", async () => {
  expect(await call()).toMatchSnapshot();
});

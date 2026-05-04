import { expect, test } from "vitest";
import { GET } from "@/app/api/[chronicle]/locations/route";
import {
  resolveLocationForCoordinate,
  getHuntingZoneById,
} from "@/lib/data/indexes";

/**
 * M7 Stage 1 lockdown:
 *
 *   - `GET /api/[chronicle]/locations` returns the spatial-only
 *     catalog (territory catch-alls dropped at parse time).
 *   - `resolveLocationForCoordinate` does nearest-anchor lookup
 *     within the 10000-unit threshold, ignoring Z. Pinned to
 *     Darin's known coord and a known mid-range monster coord.
 *   - Out-of-grid coordinates resolve to `null`.
 */
async function call() {
  const response = await GET(
    new Request("http://test/api/interlude/locations"),
    { params: Promise.resolve({ chronicle: "interlude" }) }
  );
  return { status: response.status, body: await response.json() };
}

test("locations catalog (Interlude, spatial-only)", async () => {
  expect(await call()).toMatchSnapshot();
});

test("resolveLocationForCoordinate — Darin's spawn resolves to a Talking Island anchor", () => {
  // Darin (NPC 30048) — Talking Island Village.
  // Coord from data/generated/interlude/spawns.json: (-84436, 242793, -3729).
  const result = resolveLocationForCoordinate(
    "interlude",
    -84436,
    242793,
    -3729
  );
  expect(result).not.toBeNull();
  expect(result?.name).toMatch(/Talking Island/);
});

test("resolveLocationForCoordinate — out-of-world coords resolve to null", () => {
  // Far outside the continent in every direction — no anchor within 10000 units.
  expect(
    resolveLocationForCoordinate("interlude", 5_000_000, 0, 0)
  ).toBeNull();
  expect(
    resolveLocationForCoordinate("interlude", 0, 5_000_000, 0)
  ).toBeNull();
});

test("getHuntingZoneById returns a known fixture for Cruma Tower", () => {
  // Cruma Tower is id=5 in huntingzone-e.dat per the inspection.
  const cruma = getHuntingZoneById("interlude", 5);
  expect(cruma).toBeDefined();
  expect(cruma?.name).toBe("Cruma Tower");
  expect(cruma?.minLevel).toBe(40);
});

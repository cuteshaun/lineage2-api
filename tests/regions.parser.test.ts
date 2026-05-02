import { expect, test } from "vitest";
import {
  getRegionById,
  getRegions,
  resolveRegionForCoordinate,
  resolveRegionForSpawn,
} from "@/lib/data/indexes";

/**
 * M4 Stage 1 lockdown — verifies the build-time `parse-regions.ts`
 * artifact loaded into the runtime indexes:
 *
 *   - Catalog has the 19 canonical Interlude regions, sorted by id,
 *     starting with "Talking Island Village" at id 0.
 *   - The conversion formula (`(x >> 15) + originX`,
 *     `(y >> 15) + originY`) matches aCis `MapRegionData.java` —
 *     pinned by Darin's actual spawn coord, which must resolve to
 *     region 0.
 *   - Out-of-grid and missing-id inputs return `null` /
 *     `undefined`. There is no synthetic "Unknown" region.
 *
 * No public API surface is exercised here (Stage 2 lands the DTOs
 * and snapshots that will lock the externally-visible behavior).
 */

test("regions catalog has 19 entries, sorted by id, starting with Talking Island Village", () => {
  const all = getRegions("interlude");
  expect(all.length).toBe(19);
  expect(all.map((r) => r.id)).toEqual(Array.from({ length: 19 }, (_, i) => i));
  expect(all[0]).toEqual({ id: 0, name: "Talking Island Village" });
  expect(all[18]).toEqual({ id: 18, name: "Primeval Isle" });
});

test("getRegionById returns the named region for a known id", () => {
  expect(getRegionById("interlude", 5)).toEqual({
    id: 5,
    name: "Town of Gludio",
  });
  expect(getRegionById("interlude", 10)).toEqual({
    id: 10,
    name: "Town of Aden",
  });
});

test("getRegionById returns undefined for unknown id", () => {
  expect(getRegionById("interlude", 999)).toBeUndefined();
  expect(getRegionById("interlude", -1)).toBeUndefined();
});

test("resolveRegionForCoordinate pins Darin's spawn to region 0 (Talking Island Village)", () => {
  // Darin (NPC 30048) — Talking Island Village.
  // Source-of-truth coord from data/generated/interlude/spawns.json.
  // Conversion (matches MapRegionData.java):
  //   rX = (-84436 >> 15) + 4 = -3 + 4 = 1
  //   rY = (242793  >> 15) + 8 =  7 + 8 = 15
  // Cell (rX=1, rY=15) in the parsed grid maps to region id 0.
  expect(resolveRegionForCoordinate("interlude", -84436, 242793)).toEqual({
    id: 0,
    name: "Talking Island Village",
  });
});

test("resolveRegionForSpawn is a thin wrapper over resolveRegionForCoordinate", () => {
  const darinSpawn = {
    npcId: 30048,
    x: -84436,
    y: 242793,
    z: -3729,
    heading: 42000,
    respawnDelay: 60,
    respawnRandom: 0,
    periodOfDay: 0,
  };
  expect(resolveRegionForSpawn("interlude", darinSpawn)).toEqual({
    id: 0,
    name: "Talking Island Village",
  });
});

test("resolveRegionForCoordinate returns null for out-of-grid coordinates", () => {
  // Far outside the (11 × 16) grid in every direction.
  expect(resolveRegionForCoordinate("interlude", 5_000_000, 0)).toBeNull();
  expect(resolveRegionForCoordinate("interlude", -5_000_000, 0)).toBeNull();
  expect(resolveRegionForCoordinate("interlude", 0, 5_000_000)).toBeNull();
  expect(resolveRegionForCoordinate("interlude", 0, -5_000_000)).toBeNull();
});

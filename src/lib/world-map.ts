/**
 * Lineage 2 world-to-map coordinate calibration.
 *
 * The bundled `src/interlude-big-map.png` is 1812×2620 and approximately
 * covers the following world coordinate bounds. These values are a
 * first-pass calibration for the spawn-map spike:
 *
 *   X: [-131072, 229376]  →  width  360448 world units
 *   Y: [-262144, 262144]  →  height 524288 world units
 *
 * Aspect check: world 524288 / 360448 ≈ 1.455 vs image 2620 / 1812 ≈ 1.445
 * (within 0.7%). Tile-aligned: each value is a multiple of 32768, which
 * matches the L2 tile system (every tile is 32768 world units).
 *
 * Spot-check with known landmarks:
 *   - Giran Town         (~83500, 148000)  → ~60% right, ~78% down
 *   - Dion Village       (~15670, 142900)  → ~41% right, ~77% down
 *   - Talking Island     (~-84318, 244579) → ~13% right, ~97% down
 *
 * Mapping is affine and approximate — the user was explicit this is a
 * spike. If a specific NPC's markers look off after visual inspection,
 * tweak the WORLD_* constants below; everything else flows from them.
 *
 * L2 convention: X increases east (right on map), Y increases south (down
 * on map). Top-left of the image ≈ (WORLD_MIN_X, WORLD_MIN_Y); bottom-right
 * ≈ (WORLD_MAX_X, WORLD_MAX_Y). `z` is ignored for marker positioning —
 * it's only shown in tooltip text.
 */

export const WORLD_MIN_X = -131072;
export const WORLD_MAX_X = 229376;
export const WORLD_MIN_Y = -262144;
export const WORLD_MAX_Y = 262144;

export interface MapPosition {
  /** Left offset as a CSS percentage string, e.g. "42.5%". */
  left: string;
  /** Top offset as a CSS percentage string, e.g. "67.2%". */
  top: string;
}

/**
 * Convert L2 world X/Y to image-relative CSS percentages. Because the
 * marker container's aspect ratio matches the image, percentages stay
 * accurate at any render size.
 *
 * Coordinates outside the calibrated bounds are clamped to [0, 100] so
 * out-of-range spawns land on the map edge rather than escaping the
 * container.
 */
export function worldToMap(x: number, y: number): MapPosition {
  const xPct = ((x - WORLD_MIN_X) / (WORLD_MAX_X - WORLD_MIN_X)) * 100;
  const yPct = ((y - WORLD_MIN_Y) / (WORLD_MAX_Y - WORLD_MIN_Y)) * 100;
  return {
    left: `${Math.max(0, Math.min(100, xPct))}%`,
    top: `${Math.max(0, Math.min(100, yPct))}%`,
  };
}

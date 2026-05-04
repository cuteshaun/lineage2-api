import { getHuntingZones } from "@/lib/data/indexes";
import { toLocationRefDto } from "@/lib/api/dto/location";
import { jsonList, parseChronicleParam } from "@/lib/api/responses";

// Public catalog of player-facing hunting / map locations for the
// chronicle (M7 Stage 1). For Interlude that's 209 spatial entries
// from `huntingzone-e.dat` — *Cruma Tower*, *Ant Nest*, *Sea of
// Spores*, *Tower of Insolence*, etc. Empty list when the chronicle
// ships no `huntingzone-e.dat`.
//
// Single-page response (no pagination params) — the catalog is
// small and fixed, same shape as `/regions` and `/armor-sets`.
//
// **Important — not polygon-accurate.** Each entry carries a
// single `(x, y, z)` center anchor, not a polygon. Coordinate
// resolution at the spawn / detail level uses
// nearest-anchor-with-threshold (10000 game units, 2D); a
// player-facing approximation, not a geometric containment check.
//
// Territory catch-alls ("Dion Territory", "Aden Territory", etc.)
// are intentionally excluded — they overlap the M4 `mapRegions`
// table and have no spatial anchor.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const locations = getHuntingZones(parsed.chronicle).map(toLocationRefDto);
  return jsonList(locations, {
    total: locations.length,
    limit: locations.length,
    offset: 0,
  });
}

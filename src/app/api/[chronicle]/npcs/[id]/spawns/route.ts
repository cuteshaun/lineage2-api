import { getNpcById, getNpcSpawns } from "@/lib/data/indexes";
import { toEnrichedSpawnDto } from "@/lib/api/dto/spawn";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

// Cleaned spawn points for a given NPC id. Each row is enriched with
// a resolved `region: RegionRefDto | null` (M4 Stage 2). Returns
// `200` with an empty array when the NPC exists but has no spawns
// in `spawnlist.sql`; `404` only when the NPC id is not known.
//
// Coordinates that fall outside the upstream mapRegions.xml tile
// grid resolve to `region: null` (no synthetic "Unknown"). The raw
// equivalent at `/api/[chronicle]/raw/monsters/[id]/spawns` does
// NOT carry the region field — raw stays close to engine truth.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const npc = getNpcById(parsed.chronicle, parsed.id);
  if (!npc) {
    return jsonError(`NPC ${parsed.id} not found`, 404);
  }

  const spawns = getNpcSpawns(parsed.chronicle, parsed.id);
  return jsonOk(spawns.map((s) => toEnrichedSpawnDto(s, parsed.chronicle)));
}

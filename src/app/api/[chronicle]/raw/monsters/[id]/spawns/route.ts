import { getRawMonsterById, getRawNpcSpawns } from "@/lib/data/indexes";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

// Raw spawn points for a given raw monster id. Same monster-type
// gatekeeping as `/api/[chronicle]/raw/monsters/[id]`: an id that points at
// a non-monster NPC (e.g. a Folk merchant) returns `404`, not the NPC's
// spawns. Returns `200` with `[]` when the raw monster exists but has no
// spawns in `spawnlist.sql`.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const monster = getRawMonsterById(parsed.chronicle, parsed.id);
  if (!monster) {
    return jsonError(`Monster ${parsed.id} not found`, 404);
  }

  const spawns = getRawNpcSpawns(parsed.chronicle, parsed.id);
  return jsonOk(spawns);
}

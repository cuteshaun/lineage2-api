import { getNpcById, getNpcSpawns } from "@/lib/data/indexes";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

// Raw spawn points for a given NPC id. Returns `200` with an empty array
// when the NPC exists but has no spawns in `spawnlist.sql`; `404` only when
// the NPC id is not known. No enrichment (no location names, no grouping).

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
  return jsonOk(spawns);
}

import { getMonsterById } from "@/lib/data/indexes";
import { toNpcDetailDto } from "@/lib/api/dto/npc";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

// Public monster detail — cleaned view. The `[id]` parameter accepts either:
//   - the canonical id (= the cleaned NPC's `id`), or
//   - any merged raw id from `mergedIds`.
// Both resolve to the same cleaned record. Non-monster NPCs return 404 so
// this endpoint mirrors the monster-type gate applied in the list handler.
// For the source-faithful single raw entry use `/api/[chronicle]/raw/monsters/[id]`.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const monster = getMonsterById(parsed.chronicle, parsed.id);
  if (!monster) {
    return jsonError(`Monster ${parsed.id} not found`, 404);
  }

  return jsonOk(toNpcDetailDto(monster));
}

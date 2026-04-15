import { getMonsterGroupByAnyId } from "@/lib/data/indexes";
import { toMonsterGroupDetail } from "@/lib/api/monster-groups";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

// Public monster detail — returns a monster group (one per exact name).
// The `[id]` may be:
//   - a group id (= lowest canonicalId among variants), or
//   - any canonical monster id (resolves to the containing group), or
//   - any raw monster id (resolves raw → canonical → group)
// All three resolve to the same group. Callers who need a single raw
// source-faithful entry should use `/api/[chronicle]/raw/monsters/[id]`.
//
// The response wraps the existing canonical detail per variant — each
// variant carries the same template fields the canonical layer already
// served (including `sameTemplateEntries`). The `otherVariants` array is
// no longer needed at the variant level: variants are now siblings under
// one group and visible together inline.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const group = getMonsterGroupByAnyId(parsed.chronicle, parsed.id);
  if (!group) {
    return jsonError(`Monster ${parsed.id} not found`, 404);
  }

  return jsonOk(toMonsterGroupDetail(group));
}

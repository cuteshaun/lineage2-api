import { getRawMonsterById } from "@/lib/data/indexes";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

// Raw monster detail — looks up a single raw monster by its source-faithful
// id. The cleaned equivalent lives at `/api/[chronicle]/monsters/[id]`, which
// accepts either the canonical id or any merged raw id.

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

  return jsonOk(monster);
}

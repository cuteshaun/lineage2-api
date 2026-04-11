import { getMonsterById } from "@/lib/data/indexes";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

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

  return jsonOk(monster);
}

import { getQuestById } from "@/lib/data/indexes";
import { toQuestDetailDto } from "@/lib/api/dto/quest";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const q = getQuestById(parsed.chronicle, parsed.id);
  if (!q) {
    return jsonError(`Quest ${parsed.id} not found`, 404);
  }

  return jsonOk(toQuestDetailDto(q, parsed.chronicle));
}

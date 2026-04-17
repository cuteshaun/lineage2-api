import { getItemById } from "@/lib/data/indexes";
import { toItemDetailDto } from "@/lib/api/dto/item";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const item = getItemById(parsed.chronicle, parsed.id);
  if (!item) {
    return jsonError(`Item ${parsed.id} not found`, 404);
  }

  return jsonOk(toItemDetailDto(item, parsed.chronicle));
}

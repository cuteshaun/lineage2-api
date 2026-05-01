import { buildShopResponse } from "@/lib/api/dto/shop";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const response = buildShopResponse(parsed.chronicle, parsed.id);
  if (!response) {
    return jsonError(`NPC ${parsed.id} not found`, 404);
  }

  return jsonOk(response);
}

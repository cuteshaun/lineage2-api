import { getEnrichedNpcDrops } from "@/lib/api/drops";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const enriched = getEnrichedNpcDrops(parsed.chronicle, parsed.id);
  if (!enriched) {
    return jsonError(`No drops found for NPC ${parsed.id}`, 404);
  }

  return jsonOk(enriched);
}

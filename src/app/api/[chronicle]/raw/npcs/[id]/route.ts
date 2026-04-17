import { getRawNpcById } from "@/lib/data/indexes";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

// Raw NPC detail — looks up a single raw NPC by its source-faithful id.
// The cleaned equivalent at `/api/[chronicle]/npcs/[id]` accepts either the
// canonical id or any merged raw id and returns the cleaned record.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const npc = getRawNpcById(parsed.chronicle, parsed.id);
  if (!npc) {
    return jsonError(`NPC ${parsed.id} not found`, 404);
  }

  return jsonOk(npc);
}

import { getClassById } from "@/lib/data/indexes";
import { toClassDetailDto } from "@/lib/api/dto/class";
import { jsonError, jsonOk, parseChronicleParam } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const resolved = await params;
  const parsed = parseChronicleParam({ chronicle: resolved.chronicle });
  if (!parsed.ok) return parsed.response;

  // Class ids start at 0 (Human Fighter), so we accept >= 0 here unlike
  // items/NPCs where 0 is reserved.
  const id = Number(resolved.id);
  if (!Number.isInteger(id) || id < 0) {
    return jsonError(`Invalid id: ${resolved.id}`, 400);
  }

  const cls = getClassById(parsed.chronicle, id);
  if (!cls) {
    return jsonError(`Class ${id} not found`, 404);
  }

  return jsonOk(toClassDetailDto(cls, parsed.chronicle));
}

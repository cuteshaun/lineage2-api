import { getHennaBySymbolId } from "@/lib/data/indexes";
import { toHennaDetailDto } from "@/lib/api/dto/henna";
import { jsonError, jsonOk, parseChronicleParam } from "@/lib/api/responses";

// Per-symbol detail (M8). Path id is the source XML `symbolId` (1..N).
// Returns the same fields as the catalog plus the resolved
// `allowedClasses: ClassRefDto[]`.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const resolved = await params;
  const parsed = parseChronicleParam({ chronicle: resolved.chronicle });
  if (!parsed.ok) return parsed.response;

  const symbolId = Number(resolved.id);
  if (!Number.isInteger(symbolId) || symbolId <= 0) {
    return jsonError(`Invalid id: ${resolved.id}`, 400);
  }

  const henna = getHennaBySymbolId(parsed.chronicle, symbolId);
  if (!henna) {
    return jsonError(`Henna ${symbolId} not found`, 404);
  }

  return jsonOk(toHennaDetailDto(henna, parsed.chronicle));
}

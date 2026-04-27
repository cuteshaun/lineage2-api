import { getArmorSetById } from "@/lib/data/indexes";
import { toArmorSetDetailDto } from "@/lib/api/dto/armor-set";
import { jsonError, jsonOk, parseEntityParams } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const set = getArmorSetById(parsed.chronicle, parsed.id);
  if (!set) {
    return jsonError(`Armor set ${parsed.id} not found`, 404);
  }

  return jsonOk(toArmorSetDetailDto(set, parsed.chronicle));
}

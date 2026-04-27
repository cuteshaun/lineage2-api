import { getAllArmorSets } from "@/lib/data/indexes";
import { toArmorSetDetailDto } from "@/lib/api/dto/armor-set";
import { jsonList, parseChronicleParam } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const sets = getAllArmorSets(parsed.chronicle).map((s) =>
    toArmorSetDetailDto(s, parsed.chronicle)
  );

  return jsonList(sets, {
    total: sets.length,
    limit: sets.length,
    offset: 0,
  });
}

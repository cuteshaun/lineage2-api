import { getItemSpoiledBy } from "@/lib/data/indexes";
import { toItemSourcesResponseDto } from "@/lib/api/dto/drops";
import { jsonOk, parseEntityParams } from "@/lib/api/responses";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const sources = getItemSpoiledBy(parsed.chronicle, parsed.id);

  return jsonOk(toItemSourcesResponseDto(sources, parsed.id));
}

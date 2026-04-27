import { getArmorSets } from "@/lib/data/indexes";
import { toArmorSetListDto } from "@/lib/api/dto/armor-set";
import {
  jsonList,
  parseChronicleParam,
  parsePagination,
} from "@/lib/api/responses";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination.ok) return pagination.response;

  const result = getArmorSets(parsed.chronicle, {
    ...pagination.pagination,
    q: url.searchParams.get("q"),
  });

  return jsonList(result.data.map(toArmorSetListDto), {
    total: result.total,
    limit: pagination.pagination.limit,
    offset: pagination.pagination.offset,
  });
}

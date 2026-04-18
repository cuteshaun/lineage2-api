import { getItemSpoiledBy } from "@/lib/data/indexes";
import { toItemSourcesPageDto } from "@/lib/api/dto/drops";
import {
  jsonList,
  parseEntityParams,
  parsePagination,
} from "@/lib/api/responses";

const DEFAULT_LIMIT = 25;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination.ok) return pagination.response;

  const limit =
    url.searchParams.get("limit") === null
      ? DEFAULT_LIMIT
      : pagination.pagination.limit;
  const offset = pagination.pagination.offset;

  const sources = getItemSpoiledBy(parsed.chronicle, parsed.id);
  const result = toItemSourcesPageDto(sources, limit, offset);

  return jsonList(result.data, { total: result.total, limit, offset });
}

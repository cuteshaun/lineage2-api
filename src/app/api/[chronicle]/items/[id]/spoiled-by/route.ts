import { getItemById, getItemSpoiledBy } from "@/lib/data/indexes";
import { toItemSourcesPageDto } from "@/lib/api/dto/drops";
import {
  handleCorsOptions,
  jsonError,
  jsonList,
  parseEntityParams,
  parsePagination,
} from "@/lib/api/responses";

const DEFAULT_LIMIT = 25;

// Existence contract: unknown item → 404 (same check as `/items/[id]`);
// known item with no spoil sources → 200 with an empty page.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ chronicle: string; id: string }> }
) {
  const parsed = parseEntityParams(await params);
  if (!parsed.ok) return parsed.response;

  if (!getItemById(parsed.chronicle, parsed.id)) {
    return jsonError(`Item ${parsed.id} not found`, 404);
  }

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
export async function OPTIONS(): Promise<Response> {
  return handleCorsOptions();
}

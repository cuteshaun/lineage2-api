import { getItems, type ItemSortField } from "@/lib/data/indexes";
import { toItemListDto } from "@/lib/api/dto/item";
import {
  jsonError,
  jsonList,
  parseChronicleParam,
  parsePagination,
  parseSortParam,
} from "@/lib/api/responses";

const ALLOWED_TYPES = new Set(["weapon", "armor", "etcitem"]);
const ALLOWED_GRADES = new Set(["none", "d", "c", "b", "a", "s"]);
const ITEM_SORT_FIELDS = ["id", "name", "grade"] as const satisfies readonly ItemSortField[];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination.ok) return pagination.response;

  const type = url.searchParams.get("type");
  if (type !== null && !ALLOWED_TYPES.has(type.toLowerCase())) {
    return jsonError(
      `Invalid type: ${type}. Allowed: ${[...ALLOWED_TYPES].join(", ")}`,
      400
    );
  }

  const grade = url.searchParams.get("grade");
  if (grade !== null && !ALLOWED_GRADES.has(grade.toLowerCase())) {
    return jsonError(
      `Invalid grade: ${grade}. Allowed: ${[...ALLOWED_GRADES].join(", ")}`,
      400
    );
  }

  const sort = parseSortParam(url.searchParams, ITEM_SORT_FIELDS);
  if (!sort.ok) return sort.response;

  const result = getItems(parsed.chronicle, {
    ...pagination.pagination,
    q: url.searchParams.get("q"),
    type,
    grade,
    sort: sort.value,
  });

  return jsonList(result.data.map(toItemListDto), {
    total: result.total,
    limit: pagination.pagination.limit,
    offset: pagination.pagination.offset,
  });
}

import {
  getMonsters,
  MONSTER_NPC_TYPE_MAP,
  type NpcSortField,
} from "@/lib/data/indexes";
import {
  jsonError,
  jsonList,
  parseChronicleParam,
  parseEnumParam,
  parseOptionalInt,
  parsePagination,
  parseSortParam,
} from "@/lib/api/responses";

const NPC_SORT_FIELDS = ["id", "name", "level"] as const satisfies readonly NpcSortField[];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination.ok) return pagination.response;

  const levelMin = parseOptionalInt(url.searchParams, "levelMin");
  if (!levelMin.ok) return levelMin.response;
  const levelMax = parseOptionalInt(url.searchParams, "levelMax");
  if (!levelMax.ok) return levelMax.response;

  if (
    levelMin.value !== null &&
    levelMax.value !== null &&
    levelMin.value > levelMax.value
  ) {
    return jsonError("Invalid range: levelMin > levelMax", 400);
  }

  // For /monsters, npcType is restricted to the monster subset.
  const npcType = parseEnumParam(
    url.searchParams,
    "npcType",
    MONSTER_NPC_TYPE_MAP
  );
  if (!npcType.ok) return npcType.response;

  const sort = parseSortParam(url.searchParams, NPC_SORT_FIELDS);
  if (!sort.ok) return sort.response;

  const result = getMonsters(parsed.chronicle, {
    ...pagination.pagination,
    q: url.searchParams.get("q"),
    levelMin: levelMin.value,
    levelMax: levelMax.value,
    npcType: npcType.value,
    sort: sort.value,
  });

  return jsonList(result.data, {
    total: result.total,
    limit: pagination.pagination.limit,
    offset: pagination.pagination.offset,
  });
}

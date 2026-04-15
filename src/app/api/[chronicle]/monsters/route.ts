import {
  getMonsterGroupsList,
  MONSTER_NPC_TYPE_MAP,
  type NpcSortField,
} from "@/lib/data/indexes";
import { toMonsterGroupSummary } from "@/lib/api/monster-groups";
import {
  jsonError,
  jsonList,
  parseChronicleParam,
  parseEnumParam,
  parseOptionalInt,
  parsePagination,
  parseSortParam,
} from "@/lib/api/responses";

// Public monster list — returns one entry per exact monster name (a
// "monster group"). Each group aggregates the canonical templates that
// share the name. For the source-faithful view of every raw monster
// preserved as separate rows, see `/api/[chronicle]/raw/monsters`.
//
// Existing query params are preserved; their semantics adapt to the
// grouped model (see `getMonsterGroupsList` in lib/data/indexes.ts):
//   - q              : substring on group name
//   - npcType        : group matches if any variant has this type
//   - levelMin/Max   : group matches if any variant's level is in range
//   - sort=level asc → by min variant level; desc → by max variant level
//   - sort=id        → by groupId

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

  const npcType = parseEnumParam(
    url.searchParams,
    "npcType",
    MONSTER_NPC_TYPE_MAP
  );
  if (!npcType.ok) return npcType.response;

  const sort = parseSortParam(url.searchParams, NPC_SORT_FIELDS);
  if (!sort.ok) return sort.response;

  const result = getMonsterGroupsList(parsed.chronicle, {
    ...pagination.pagination,
    q: url.searchParams.get("q"),
    levelMin: levelMin.value,
    levelMax: levelMax.value,
    npcType: npcType.value,
    sort: sort.value,
  });

  return jsonList(result.data.map(toMonsterGroupSummary), {
    total: result.total,
    limit: pagination.pagination.limit,
    offset: pagination.pagination.offset,
  });
}

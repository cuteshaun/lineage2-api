import type { Chronicle } from "../chronicles";
import type { Item, Npc, NpcDrops } from "../types";
import { loadChronicleDataset } from "./loaders";
import {
  buildCanonicalMonsters,
  type CanonicalMonster,
} from "./canonical-monsters";
import {
  buildMonsterGroups,
  type MonsterGroup,
} from "./monster-groups";

export type { CanonicalMonster } from "./canonical-monsters";
export type { MonsterGroup } from "./monster-groups";

/** A single reverse-lookup entry: which NPC drops/spoils a given item. */
export interface ItemSourceEntry {
  npc: { id: number; name: string; type: string | null; level: number | null };
  entry: {
    min: number | null;
    max: number | null;
    chance: number | null;
    category: number | null;
  };
}

interface ChronicleIndexes {
  items: Item[];
  npcs: Npc[];
  monsters: Npc[];
  itemsById: Map<number, Item>;
  npcsById: Map<number, Npc>;
  dropsByNpcId: Map<number, NpcDrops>;
  /** Lowercase npcType → canonical npcType (e.g. "raidboss" → "RaidBoss"). */
  npcTypeMap: Map<string, string>;
  /** Sorted introspection list of all npcType values with counts and monster flag. */
  npcTypeSummary: NpcTypeSummary[];
  /** Sorted introspection list of all item type values with counts. */
  itemTypeSummary: NameCount[];
  /** Sorted introspection list of all item grade values with counts. */
  itemGradeSummary: NameCount[];
  /** Reverse lookup: itemId → NPCs that drop the item (category != -1). */
  itemDroppedBy: Map<number, ItemSourceEntry[]>;
  /** Reverse lookup: itemId → NPCs that spoil the item (category == -1). */
  itemSpoiledBy: Map<number, ItemSourceEntry[]>;
  /** Canonical (template-deduped) monsters. See `canonical-monsters.ts`. */
  canonicalMonsters: CanonicalMonster[];
  /** Lookup by canonical id (= lowest raw id in the template group). */
  canonicalMonstersById: Map<number, CanonicalMonster>;
  /** Map every raw monster id to its canonical id. */
  rawMonsterIdToCanonicalId: Map<number, number>;
  /** Public monster groups — one entry per exact name. See `monster-groups.ts`. */
  monsterGroups: MonsterGroup[];
  /** Lookup by group id (= lowest canonical id among the group's variants). */
  monsterGroupsById: Map<number, MonsterGroup>;
  /** Map every canonical monster id to its containing group id. */
  canonicalIdToGroupId: Map<number, number>;
}

export interface NpcTypeSummary {
  name: string;
  isMonster: boolean;
  count: number;
}

export interface NameCount {
  name: string;
  count: number;
}

/**
 * NPC types that count as "monsters" for the /monsters endpoint.
 * Derived from the schema survey of aCis Interlude NPC data — these are the
 * `npcType` values that represent killable, lootable, hostile-or-quasi-hostile
 * world entities (not merchants, gatekeepers, etc.).
 */
export const MONSTER_NPC_TYPES = new Set([
  "Monster",
  "RaidBoss",
  "GrandBoss",
  "FestivalMonster",
  "RiftInvader",
  "PenaltyMonster",
  "FriendlyMonster",
  "FeedableBeast",
  "TamedBeast",
  "Chest",
  "HalishaChest",
]);

/** Lowercase monster npcType → canonical form, for case-insensitive validation. */
export const MONSTER_NPC_TYPE_MAP: Map<string, string> = new Map(
  [...MONSTER_NPC_TYPES].map((t) => [t.toLowerCase(), t])
);

/**
 * Lineage-grade rank order. Used by both the `/meta/item-grades` listing and
 * `/items?sort=grade`, so the two stay in lockstep. Unknown grades sort after
 * the known ones (alphabetically among themselves) — see `gradeRank()`.
 */
export const ITEM_GRADE_ORDER = ["none", "d", "c", "b", "a", "s"] as const;

const GRADE_RANK = new Map<string, number>(
  ITEM_GRADE_ORDER.map((g, i) => [g, i])
);

/** Returns the rank of a grade, or `Infinity` if it's not a known grade. */
export function gradeRank(grade: string): number {
  return GRADE_RANK.get(grade) ?? Number.POSITIVE_INFINITY;
}

const indexCache = new Map<Chronicle, ChronicleIndexes>();

function buildIndexes(chronicle: Chronicle): ChronicleIndexes {
  const dataset = loadChronicleDataset(chronicle);
  const monsters = dataset.npcs.filter(
    (n) => n.npcType !== null && MONSTER_NPC_TYPES.has(n.npcType)
  );

  // Single pass over npcs: build the lowercase→canonical map AND collect counts
  // per type. Both feed downstream features (filter validation + introspection)
  // from one source of truth.
  const npcTypeMap = new Map<string, string>();
  const npcTypeCounts = new Map<string, number>();
  for (const n of dataset.npcs) {
    if (n.npcType === null) continue;
    if (!npcTypeMap.has(n.npcType.toLowerCase())) {
      npcTypeMap.set(n.npcType.toLowerCase(), n.npcType);
    }
    npcTypeCounts.set(n.npcType, (npcTypeCounts.get(n.npcType) ?? 0) + 1);
  }

  const npcTypeSummary: NpcTypeSummary[] = [...npcTypeCounts.entries()]
    .map(([name, count]) => ({
      name,
      isMonster: MONSTER_NPC_TYPES.has(name),
      count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Single pass over items: collect counts per type and per grade for the
  // /meta/item-types and /meta/item-grades introspection endpoints.
  const itemTypeCounts = new Map<string, number>();
  const itemGradeCounts = new Map<string, number>();
  for (const it of dataset.items) {
    itemTypeCounts.set(it.type, (itemTypeCounts.get(it.type) ?? 0) + 1);
    itemGradeCounts.set(it.grade, (itemGradeCounts.get(it.grade) ?? 0) + 1);
  }

  const itemTypeSummary: NameCount[] = [...itemTypeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Item grades follow Lineage rank order (none → d → c → b → a → s).
  // Unknown grades (if any future dataset introduces them) sort after the
  // known ones, alphabetically among themselves.
  const itemGradeSummary: NameCount[] = [...itemGradeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const ra = gradeRank(a.name);
      const rb = gradeRank(b.name);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });

  // Build reverse-lookup indexes: itemId → which NPCs drop/spoil the item.
  // Category -1 = spoil, everything else = normal drop.
  const npcsById = new Map(dataset.npcs.map((n) => [n.id, n]));
  const itemDroppedBy = new Map<number, ItemSourceEntry[]>();
  const itemSpoiledBy = new Map<number, ItemSourceEntry[]>();

  for (const npcDrops of dataset.drops) {
    const npc = npcsById.get(npcDrops.npcId);
    if (!npc) continue;
    const npcSummary = {
      id: npc.id,
      name: npc.name,
      type: npc.npcType,
      level: npc.level,
    };

    for (const cat of npcDrops.categories) {
      const isSpoil = cat.categoryId === -1;
      const target = isSpoil ? itemSpoiledBy : itemDroppedBy;

      for (const drop of cat.drops) {
        const entry: ItemSourceEntry = {
          npc: npcSummary,
          entry: {
            min: drop.min,
            max: drop.max,
            chance: drop.chance,
            category: cat.categoryId,
          },
        };
        let list = target.get(drop.itemId);
        if (!list) {
          list = [];
          target.set(drop.itemId, list);
        }
        list.push(entry);
      }
    }
  }

  // Build the canonical monster layer (template-grouped raw monsters).
  // The raw layer above is unchanged — every raw monster remains reachable
  // via `monsters`, `npcsById`, and the existing `getMonsterById()`.
  const dropsByNpcId = new Map(dataset.drops.map((d) => [d.npcId, d]));
  const canonical = buildCanonicalMonsters(monsters, dropsByNpcId);

  // Build the public monster group layer on top of canonical. Groups by
  // exact name. The canonical layer remains internal foundation — public
  // /monsters now serves these groups instead of canonicals directly.
  const groups = buildMonsterGroups(canonical.canonicalMonsters);

  return {
    items: dataset.items,
    npcs: dataset.npcs,
    monsters,
    itemsById: new Map(dataset.items.map((i) => [i.id, i])),
    npcsById,
    dropsByNpcId,
    npcTypeMap,
    npcTypeSummary,
    itemTypeSummary,
    itemGradeSummary,
    itemDroppedBy,
    itemSpoiledBy,
    canonicalMonsters: canonical.canonicalMonsters,
    canonicalMonstersById: canonical.canonicalMonstersById,
    rawMonsterIdToCanonicalId: canonical.rawIdToCanonicalId,
    monsterGroups: groups.groups,
    monsterGroupsById: groups.groupsById,
    canonicalIdToGroupId: groups.canonicalIdToGroupId,
  };
}

/**
 * Returns a Map of every known `npcType` value for the chronicle, keyed by
 * its lowercase form for case-insensitive validation. Values are the canonical
 * (PascalCase) form as stored in the dataset.
 */
export function getKnownNpcTypeMap(chronicle: Chronicle): Map<string, string> {
  return getChronicleIndexes(chronicle).npcTypeMap;
}

/**
 * Returns the introspection list of all npcType values for the chronicle,
 * with counts and an `isMonster` flag derived from the same source of truth
 * (`MONSTER_NPC_TYPES`) used by `getMonsters()`. Sorted by name.
 */
export function getNpcTypeSummary(chronicle: Chronicle): NpcTypeSummary[] {
  return getChronicleIndexes(chronicle).npcTypeSummary;
}

/**
 * Returns the introspection list of all item type values for the chronicle
 * with counts. Computed from the actual items dataset, not a hardcoded enum.
 * Sorted by name.
 */
export function getItemTypeSummary(chronicle: Chronicle): NameCount[] {
  return getChronicleIndexes(chronicle).itemTypeSummary;
}

/**
 * Returns the introspection list of all item grade values for the chronicle
 * with counts. Computed from the actual items dataset, not a hardcoded enum.
 * Ordered by Lineage grade rank (none → d → c → b → a → s); any unknown
 * grades trail alphabetically.
 */
export function getItemGradeSummary(chronicle: Chronicle): NameCount[] {
  return getChronicleIndexes(chronicle).itemGradeSummary;
}

export function getChronicleIndexes(chronicle: Chronicle): ChronicleIndexes {
  const cached = indexCache.get(chronicle);
  if (cached) return cached;

  const indexes = buildIndexes(chronicle);
  indexCache.set(chronicle, indexes);
  return indexes;
}

// --- ID lookups ---

export function getItemById(
  chronicle: Chronicle,
  id: number
): Item | undefined {
  return getChronicleIndexes(chronicle).itemsById.get(id);
}

export function getNpcById(
  chronicle: Chronicle,
  id: number
): Npc | undefined {
  return getChronicleIndexes(chronicle).npcsById.get(id);
}

/**
 * Look up an NPC by id and return it only if it qualifies as a monster.
 * Returns `undefined` if the id is unknown OR the NPC is not a monster type.
 */
export function getMonsterById(
  chronicle: Chronicle,
  id: number
): Npc | undefined {
  const npc = getChronicleIndexes(chronicle).npcsById.get(id);
  if (!npc || npc.npcType === null) return undefined;
  return MONSTER_NPC_TYPES.has(npc.npcType) ? npc : undefined;
}

export function getDropsByNpcId(
  chronicle: Chronicle,
  npcId: number
): NpcDrops | undefined {
  return getChronicleIndexes(chronicle).dropsByNpcId.get(npcId);
}

// --- Canonical monster lookups (template-deduped view over raw monsters) ---

/**
 * Returns the full canonical monster list for the chronicle, sorted by
 * canonicalId. Each entry groups raw monsters that share an identical
 * template — see `canonical-monsters.ts` for the exact equivalence rules.
 */
export function getCanonicalMonsters(chronicle: Chronicle): CanonicalMonster[] {
  return getChronicleIndexes(chronicle).canonicalMonsters;
}

/**
 * Look up a canonical monster by its canonical id. The canonical id equals
 * the lowest raw id in the template group. Returns `undefined` if the id is
 * unknown OR if the id refers to a raw monster that is *not* the chosen
 * canonical for its group (use `getCanonicalIdForRawMonsterId` first).
 */
export function getCanonicalMonsterById(
  chronicle: Chronicle,
  canonicalId: number
): CanonicalMonster | undefined {
  return getChronicleIndexes(chronicle).canonicalMonstersById.get(canonicalId);
}

/**
 * Map a raw monster id to its canonical id. Returns `undefined` if the raw
 * id does not refer to a monster (i.e. not in the monster npcType subset).
 */
export function getCanonicalIdForRawMonsterId(
  chronicle: Chronicle,
  rawId: number
): number | undefined {
  return getChronicleIndexes(chronicle).rawMonsterIdToCanonicalId.get(rawId);
}

/**
 * Forgiving lookup used by the public canonical `/monsters/[id]` endpoint.
 * Accepts either:
 *   - a canonical id (lowest raw id in a template group), or
 *   - any raw monster id belonging to a template group.
 *
 * Both resolve to the same `CanonicalMonster`. Returns `undefined` if `id`
 * is not any known monster id (e.g. a Folk NPC id, or unknown).
 */
export function getCanonicalMonsterByAnyId(
  chronicle: Chronicle,
  id: number
): CanonicalMonster | undefined {
  const indexes = getChronicleIndexes(chronicle);
  const canonicalId = indexes.rawMonsterIdToCanonicalId.get(id);
  if (canonicalId === undefined) return undefined;
  return indexes.canonicalMonstersById.get(canonicalId);
}

// --- Monster group lookups (public name-grouped layer over canonical) ---

/**
 * Returns the full monster group list for the chronicle, sorted by groupId.
 * One entry per exact monster name. See `monster-groups.ts`.
 */
export function getMonsterGroups(chronicle: Chronicle): MonsterGroup[] {
  return getChronicleIndexes(chronicle).monsterGroups;
}

/**
 * Look up a monster group by its group id (= lowest canonicalId among
 * variants). Returns `undefined` if the id is not a known group id.
 */
export function getMonsterGroupById(
  chronicle: Chronicle,
  groupId: number
): MonsterGroup | undefined {
  return getChronicleIndexes(chronicle).monsterGroupsById.get(groupId);
}

/**
 * Forgiving lookup used by the public `/monsters/[id]` endpoint. Accepts:
 *   - a monster group id, or
 *   - any canonical monster id (resolves to the containing group), or
 *   - any raw monster id (resolves raw → canonical → group).
 *
 * Returns `undefined` if `id` is not any known monster id.
 */
export function getMonsterGroupByAnyId(
  chronicle: Chronicle,
  id: number
): MonsterGroup | undefined {
  const indexes = getChronicleIndexes(chronicle);
  // Direct group lookup first (fast path when caller already has the groupId).
  const direct = indexes.monsterGroupsById.get(id);
  if (direct) return direct;
  // Otherwise treat `id` as raw → canonical → group.
  const canonicalId = indexes.rawMonsterIdToCanonicalId.get(id);
  if (canonicalId === undefined) return undefined;
  const groupId = indexes.canonicalIdToGroupId.get(canonicalId);
  if (groupId === undefined) return undefined;
  return indexes.monsterGroupsById.get(groupId);
}

/**
 * Reverse lookup: which NPCs drop this item (normal drops, category != -1).
 * Returns an empty array if the item is not in any NPC's drop table.
 */
export function getItemDroppedBy(
  chronicle: Chronicle,
  itemId: number
): ItemSourceEntry[] {
  return getChronicleIndexes(chronicle).itemDroppedBy.get(itemId) ?? [];
}

/**
 * Reverse lookup: which NPCs spoil this item (category == -1).
 * Returns an empty array if the item is not in any NPC's spoil table.
 */
export function getItemSpoiledBy(
  chronicle: Chronicle,
  itemId: number
): ItemSourceEntry[] {
  return getChronicleIndexes(chronicle).itemSpoiledBy.get(itemId) ?? [];
}

// --- List queries ---

export interface ListResult<T> {
  data: T[];
  total: number;
}

export type SortDirection = "asc" | "desc";

export type ItemSortField = "id" | "name" | "grade";
export type NpcSortField = "id" | "name" | "level";

export interface SortSpec<F extends string> {
  field: F;
  direction: SortDirection;
}

export interface ItemListOptions {
  limit: number;
  offset: number;
  q?: string | null;
  type?: string | null;
  grade?: string | null;
  sort?: SortSpec<ItemSortField> | null;
}

export interface NpcListOptions {
  limit: number;
  offset: number;
  q?: string | null;
  levelMin?: number | null;
  levelMax?: number | null;
  /** Canonical (PascalCase) npcType. Validation must happen at the route layer. */
  npcType?: string | null;
  sort?: SortSpec<NpcSortField> | null;
}

const ASCII = (a: string, b: string) =>
  a.toLowerCase().localeCompare(b.toLowerCase());

/**
 * Stable comparator for `Item.level`-style nullable numerics. `null` always
 * sorts last regardless of direction so that pagination stays predictable.
 */
function compareNullableNumber(
  a: number | null,
  b: number | null,
  direction: SortDirection
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

// When the primary sort key is equal, fall back to `id` ascending so that
// pagination is deterministic across repeated requests. The tie-breaker is
// always ascending regardless of the primary sort direction — that way two
// rows that tie sort identically whether the user asked for `asc` or `desc`,
// which matches the convention used by Postgres `ORDER BY x DESC, id ASC`.
function itemComparator(
  spec: SortSpec<ItemSortField>
): (a: Item, b: Item) => number {
  const sign = spec.direction === "asc" ? 1 : -1;
  switch (spec.field) {
    case "id":
      return (a, b) => sign * (a.id - b.id);
    case "name":
      return (a, b) => {
        const cmp = ASCII(a.name, b.name);
        if (cmp !== 0) return sign * cmp;
        return a.id - b.id;
      };
    case "grade":
      return (a, b) => {
        const cmp = gradeRank(a.grade) - gradeRank(b.grade);
        if (cmp !== 0) return sign * cmp;
        // Tie-break unknown grades alphabetically, then by id for stability.
        const tieGrade = a.grade.localeCompare(b.grade);
        if (tieGrade !== 0) return sign * tieGrade;
        return a.id - b.id;
      };
  }
}

function npcComparator(
  spec: SortSpec<NpcSortField>
): (a: Npc, b: Npc) => number {
  const sign = spec.direction === "asc" ? 1 : -1;
  switch (spec.field) {
    case "id":
      return (a, b) => sign * (a.id - b.id);
    case "name":
      return (a, b) => {
        const cmp = ASCII(a.name, b.name);
        if (cmp !== 0) return sign * cmp;
        return a.id - b.id;
      };
    case "level":
      return (a, b) => {
        const cmp = compareNullableNumber(a.level, b.level, spec.direction);
        if (cmp !== 0) return cmp;
        return a.id - b.id;
      };
  }
}

function paginate<T>(arr: T[], limit: number, offset: number): T[] {
  return arr.slice(offset, offset + limit);
}

function matchesQuery(name: string, q: string): boolean {
  return name.toLowerCase().includes(q);
}

export function getItems(
  chronicle: Chronicle,
  options: ItemListOptions
): ListResult<Item> {
  const all = getChronicleIndexes(chronicle).items;
  const q = options.q?.trim().toLowerCase() || null;
  const type = options.type?.trim().toLowerCase() || null;
  const grade = options.grade?.trim().toLowerCase() || null;

  const filtered =
    q || type || grade
      ? all.filter((i) => {
          if (q && !matchesQuery(i.name, q)) return false;
          if (type && i.type !== type) return false;
          if (grade && i.grade !== grade) return false;
          return true;
        })
      : all;

  // Apply sort: filter → sort → paginate. Slice before sort so we never
  // mutate the cached `items` array.
  const sorted = options.sort
    ? [...filtered].sort(itemComparator(options.sort))
    : filtered;

  return {
    data: paginate(sorted, options.limit, options.offset),
    total: sorted.length,
  };
}

function filterNpcs(
  source: Npc[],
  q: string | null,
  levelMin: number | null,
  levelMax: number | null,
  npcType: string | null
): Npc[] {
  if (!q && levelMin === null && levelMax === null && !npcType) return source;
  return source.filter((n) => {
    if (q && !matchesQuery(n.name, q)) return false;
    if (levelMin !== null && (n.level === null || n.level < levelMin))
      return false;
    if (levelMax !== null && (n.level === null || n.level > levelMax))
      return false;
    if (npcType && n.npcType !== npcType) return false;
    return true;
  });
}

function listNpcsFrom(
  source: Npc[],
  options: NpcListOptions
): ListResult<Npc> {
  const q = options.q?.trim().toLowerCase() || null;
  const filtered = filterNpcs(
    source,
    q,
    options.levelMin ?? null,
    options.levelMax ?? null,
    options.npcType ?? null
  );
  const sorted = options.sort
    ? [...filtered].sort(npcComparator(options.sort))
    : filtered;
  return {
    data: paginate(sorted, options.limit, options.offset),
    total: sorted.length,
  };
}

export function getNpcs(
  chronicle: Chronicle,
  options: NpcListOptions
): ListResult<Npc> {
  return listNpcsFrom(getChronicleIndexes(chronicle).npcs, options);
}

export function getMonsters(
  chronicle: Chronicle,
  options: NpcListOptions
): ListResult<Npc> {
  return listNpcsFrom(getChronicleIndexes(chronicle).monsters, options);
}

// --- Canonical monster list (filter / sort / paginate over the template-deduped view) ---

/**
 * Canonical equivalent of `getMonsters`. Accepts the same `NpcListOptions`
 * shape (q, levelMin, levelMax, npcType, sort, limit, offset) so the public
 * canonical list endpoint preserves the existing filter/sort contract —
 * predicates simply run against each canonical's `representative` (its
 * template fields). `id` sort uses `canonicalId`.
 */
export function getCanonicalMonstersList(
  chronicle: Chronicle,
  options: NpcListOptions
): ListResult<CanonicalMonster> {
  const all = getChronicleIndexes(chronicle).canonicalMonsters;
  const q = options.q?.trim().toLowerCase() || null;
  const filtered = filterCanonicalMonsters(
    all,
    q,
    options.levelMin ?? null,
    options.levelMax ?? null,
    options.npcType ?? null
  );
  const sorted = options.sort
    ? [...filtered].sort(canonicalMonsterComparator(options.sort))
    : filtered;
  return {
    data: paginate(sorted, options.limit, options.offset),
    total: sorted.length,
  };
}

function filterCanonicalMonsters(
  source: CanonicalMonster[],
  q: string | null,
  levelMin: number | null,
  levelMax: number | null,
  npcType: string | null
): CanonicalMonster[] {
  if (!q && levelMin === null && levelMax === null && !npcType) return source;
  return source.filter((c) => {
    const r = c.representative;
    if (q && !matchesQuery(r.name, q)) return false;
    if (levelMin !== null && (r.level === null || r.level < levelMin))
      return false;
    if (levelMax !== null && (r.level === null || r.level > levelMax))
      return false;
    if (npcType && r.npcType !== npcType) return false;
    return true;
  });
}

function canonicalMonsterComparator(
  spec: SortSpec<NpcSortField>
): (a: CanonicalMonster, b: CanonicalMonster) => number {
  const sign = spec.direction === "asc" ? 1 : -1;
  switch (spec.field) {
    case "id":
      return (a, b) => sign * (a.canonicalId - b.canonicalId);
    case "name":
      return (a, b) => {
        const cmp = ASCII(a.representative.name, b.representative.name);
        if (cmp !== 0) return sign * cmp;
        return a.canonicalId - b.canonicalId;
      };
    case "level":
      return (a, b) => {
        const cmp = compareNullableNumber(
          a.representative.level,
          b.representative.level,
          spec.direction
        );
        if (cmp !== 0) return cmp;
        return a.canonicalId - b.canonicalId;
      };
  }
}

// --- Public monster group list (filter / sort / paginate, existential semantics) ---

/**
 * Filter / sort / paginate over monster groups for the public `/monsters`
 * list endpoint. Accepts the same `NpcListOptions` shape as the existing
 * monster endpoints so callers don't need a new query-param vocabulary.
 *
 * Filter semantics ("a group matches if any variant matches"):
 *   - `q`        : case-insensitive substring match on group name
 *   - `npcType`  : matches if any variant has this canonical npcType
 *   - `levelMin` : matches if any variant's level is >= levelMin
 *   - `levelMax` : matches if any variant's level is <= levelMax
 *   (variants whose level is null never match level filters)
 *
 * Sort semantics (deterministic; tie-break by groupId):
 *   - `id`     : by groupId
 *   - `name`   : alphabetical, case-insensitive
 *   - `level`  asc → by MIN variant level (groups with all-null levels last)
 *   - `level`  desc → by MAX variant level (groups with all-null levels last)
 * The asc-min / desc-max rule keeps "show me low-level monsters first"
 * intuitive even when a group's variants span multiple levels.
 */
export function getMonsterGroupsList(
  chronicle: Chronicle,
  options: NpcListOptions
): ListResult<MonsterGroup> {
  const all = getChronicleIndexes(chronicle).monsterGroups;
  const q = options.q?.trim().toLowerCase() || null;
  const filtered = filterMonsterGroups(
    all,
    q,
    options.levelMin ?? null,
    options.levelMax ?? null,
    options.npcType ?? null
  );
  const sorted = options.sort
    ? [...filtered].sort(monsterGroupComparator(options.sort))
    : filtered;
  return {
    data: paginate(sorted, options.limit, options.offset),
    total: sorted.length,
  };
}

function filterMonsterGroups(
  source: MonsterGroup[],
  q: string | null,
  levelMin: number | null,
  levelMax: number | null,
  npcType: string | null
): MonsterGroup[] {
  if (!q && levelMin === null && levelMax === null && !npcType) return source;
  return source.filter((g) => {
    if (q && !matchesQuery(g.name, q)) return false;
    if (levelMin === null && levelMax === null && !npcType) return true;
    // Existential check across variants for level/npcType filters.
    return g.variants.some((v) => {
      const r = v.representative;
      if (npcType && r.npcType !== npcType) return false;
      if (levelMin !== null && (r.level === null || r.level < levelMin))
        return false;
      if (levelMax !== null && (r.level === null || r.level > levelMax))
        return false;
      return true;
    });
  });
}

function groupLevelExtreme(
  group: MonsterGroup,
  pick: "min" | "max"
): number | null {
  let acc: number | null = null;
  for (const v of group.variants) {
    const lv = v.representative.level;
    if (lv === null) continue;
    if (acc === null) acc = lv;
    else if (pick === "min" && lv < acc) acc = lv;
    else if (pick === "max" && lv > acc) acc = lv;
  }
  return acc;
}

function monsterGroupComparator(
  spec: SortSpec<NpcSortField>
): (a: MonsterGroup, b: MonsterGroup) => number {
  const sign = spec.direction === "asc" ? 1 : -1;
  switch (spec.field) {
    case "id":
      return (a, b) => sign * (a.groupId - b.groupId);
    case "name":
      return (a, b) => {
        const cmp = ASCII(a.name, b.name);
        if (cmp !== 0) return sign * cmp;
        return a.groupId - b.groupId;
      };
    case "level":
      // asc → use MIN variant level; desc → use MAX variant level.
      // Either way, groups with all-null levels sort last (predictable
      // pagination), tie-broken by groupId.
      return (a, b) => {
        const pick = spec.direction === "asc" ? "min" : "max";
        const cmp = compareNullableNumber(
          groupLevelExtreme(a, pick),
          groupLevelExtreme(b, pick),
          spec.direction
        );
        if (cmp !== 0) return cmp;
        return a.groupId - b.groupId;
      };
  }
}

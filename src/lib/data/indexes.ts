import type { Chronicle } from "../chronicles";
import type { Item, Npc, NpcDrops } from "../types";
import { loadChronicleDataset } from "./loaders";

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

  return {
    items: dataset.items,
    npcs: dataset.npcs,
    monsters,
    itemsById: new Map(dataset.items.map((i) => [i.id, i])),
    npcsById: new Map(dataset.npcs.map((n) => [n.id, n])),
    dropsByNpcId: new Map(dataset.drops.map((d) => [d.npcId, d])),
    npcTypeMap,
    npcTypeSummary,
    itemTypeSummary,
    itemGradeSummary,
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

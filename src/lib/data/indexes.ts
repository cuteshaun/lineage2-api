import type { Chronicle } from "../chronicles";
import type {
  ArmorSet,
  Item,
  Npc,
  NpcDrops,
  Recipe,
  Skill,
  Spawn,
} from "../types";
import { loadChronicleDataset } from "./loaders";
import { buildCleanedNpcs } from "./cleaned-npcs";

/** A single reverse-lookup entry: which NPC drops/spoils a given item. */
export interface ItemSourceEntry {
  npc: { id: number; name: string; type: string | null; level: number | null };
  entry: {
    min: number | null;
    max: number | null;
    chance: number | null;
    category: number | null;
  };
  rollCount: number;
}

interface ChronicleIndexes {
  items: Item[];
  /** Raw NPCs, source-faithful (each carries `mergedIds=[id]`, `mergedCount=1`). */
  rawNpcs: Npc[];
  /** Raw monsters — `rawNpcs` filtered to monster npcTypes. */
  rawMonsters: Npc[];
  /** Cleaned NPCs — one record per unique raw `name`. */
  cleanedNpcs: Npc[];
  /** Cleaned monsters — `cleanedNpcs` filtered to monster npcTypes. */
  cleanedMonsters: Npc[];
  itemsById: Map<number, Item>;
  /** Lookup by raw id. Every raw NPC is directly reachable here. */
  rawNpcsById: Map<number, Npc>;
  /** Lookup by canonical id (= id of the cleaned NPC serving this name). */
  cleanedNpcsById: Map<number, Npc>;
  /**
   * Any raw id → the canonical id of the cleaned NPC that absorbs it. A
   * cleaned NPC's own id maps to itself. Used to accept either the canonical
   * id or any merged raw id on the cleaned routes.
   */
  mergedIdToCanonicalId: Map<number, number>;
  /** Raw drops keyed by raw npcId (source-faithful, unaggregated). */
  rawDropsByNpcId: Map<number, NpcDrops>;
  /**
   * Cleaned drops keyed by canonical npcId. Each entry is the union of drops
   * from every mergedId, deduped on `(categoryId, itemId, min, max, chance)`.
   */
  cleanedDropsById: Map<number, NpcDrops>;
  /** Lowercase npcType → canonical npcType (e.g. "raidboss" → "RaidBoss"). */
  npcTypeMap: Map<string, string>;
  /** Sorted introspection list of all npcType values with counts and monster flag. */
  npcTypeSummary: NpcTypeSummary[];
  /** Sorted introspection list of all item type values with counts. */
  itemTypeSummary: NameCount[];
  /** Sorted introspection list of all item grade values with counts. */
  itemGradeSummary: NameCount[];
  /** Reverse lookup: itemId → canonical NPCs that drop the item (category != -1). */
  itemDroppedBy: Map<number, ItemSourceEntry[]>;
  /** Reverse lookup: itemId → canonical NPCs that spoil the item (category == -1). */
  itemSpoiledBy: Map<number, ItemSourceEntry[]>;
  /** Raw spawns grouped by raw npcId. Source-faithful, unaggregated. */
  rawSpawnsByNpcId: Map<number, Spawn[]>;
  /**
   * Cleaned spawns keyed by canonical npcId — union across mergedIds,
   * deduped on the full position tuple.
   */
  cleanedSpawnsById: Map<number, Spawn[]>;
  /** SA (Special Ability) weapon variants: base weapon id → variant item ids. */
  saVariantsByBaseId: Map<number, number[]>;
  /** SA weapon variant → its base weapon id. */
  saBaseByVariantId: Map<number, number>;
  /** Items minus SA variants — used by the public list endpoint. */
  publicItems: Item[];
  /** All parsed recipes. */
  recipes: Recipe[];
  /** Recipe lookup by recipe item id (the "scroll" item). */
  recipeByRecipeItemId: Map<number, Recipe>;
  /** Recipes that produce a given product item id. */
  recipesByProductItemId: Map<number, Recipe[]>;
  /** All parsed armor sets (sorted by synthetic id ascending). */
  armorSets: ArmorSet[];
  /** Armor-set lookup by synthetic id. */
  armorSetsById: Map<number, ArmorSet>;
  /**
   * Reverse lookup: itemId → every `ArmorSet` that lists the item as a
   * piece. N:M relationship — a single helmet (e.g. Tallum Helmet `547`)
   * belongs to all three Tallum sets (Heavy / Light / Robe).
   */
  armorSetsByItemId: Map<number, ArmorSet[]>;
  /** Skill lookup by `"${id}-${level}"` key (matches `itemSkill` format). */
  skillByKey: Map<string, Skill>;
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

  // Index raw drops + spawns by raw npcId FIRST — the cleaned layer needs
  // these maps to rank candidates (has-spawns / has-drops) and to aggregate.
  const rawDropsByNpcId = new Map(dataset.drops.map((d) => [d.npcId, d]));
  const rawSpawnsByNpcId = new Map<number, Spawn[]>();
  for (const spawn of dataset.spawns) {
    let list = rawSpawnsByNpcId.get(spawn.npcId);
    if (!list) {
      list = [];
      rawSpawnsByNpcId.set(spawn.npcId, list);
    }
    list.push(spawn);
  }

  // Build the cleaned NPC layer: one record per unique name, aggregated
  // drops + spawns attached by canonical id.
  const cleanedResult = buildCleanedNpcs(
    dataset.npcs,
    rawDropsByNpcId,
    rawSpawnsByNpcId
  );

  const rawMonsters = dataset.npcs.filter(
    (n) => n.npcType !== null && MONSTER_NPC_TYPES.has(n.npcType)
  );
  const cleanedMonsters = cleanedResult.cleaned.filter(
    (n) => n.npcType !== null && MONSTER_NPC_TYPES.has(n.npcType)
  );

  // npcType map + counts: computed from raw so every source-faithful type
  // value is known to callers (validation + introspection).
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

  // Items: counts per type and per grade for the `/meta/*` introspection.
  const itemTypeCounts = new Map<string, number>();
  const itemGradeCounts = new Map<string, number>();
  for (const it of dataset.items) {
    itemTypeCounts.set(it.type, (itemTypeCounts.get(it.type) ?? 0) + 1);
    itemGradeCounts.set(it.grade, (itemGradeCounts.get(it.grade) ?? 0) + 1);
  }

  const itemTypeSummary: NameCount[] = [...itemTypeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const itemGradeSummary: NameCount[] = [...itemGradeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      const ra = gradeRank(a.name);
      const rb = gradeRank(b.name);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });

  // Reverse item lookups point at CLEANED canonical NPCs: every raw drop
  // entry's `npcId` is remapped to its canonical id, then entries are deduped
  // on `(canonicalNpcId, category, min, max, chance)`. This matches the
  // "no user-facing variants" rule — consumers see one row per canonical NPC
  // per drop parameter tuple even when multiple mergedIds contributed it.
  const itemDroppedBy = new Map<number, ItemSourceEntry[]>();
  const itemSpoiledBy = new Map<number, ItemSourceEntry[]>();
  // Track seen entries by (npcId, min, max, chance) ignoring categoryId.
  // When the same visible tuple repeats across categories, we increment
  // the existing entry's rollCount instead of adding a duplicate row.
  const droppedByIndex = new Map<number, Map<string, ItemSourceEntry>>();
  const spoiledByIndex = new Map<number, Map<string, ItemSourceEntry>>();

  for (const npcDrops of dataset.drops) {
    const canonicalId = cleanedResult.mergedIdToCanonicalId.get(npcDrops.npcId);
    if (canonicalId === undefined) continue;
    const canonicalNpc = cleanedResult.cleanedById.get(canonicalId);
    if (!canonicalNpc) continue;
    const npcSummary = {
      id: canonicalNpc.id,
      name: canonicalNpc.name,
      type: canonicalNpc.npcType,
      level: canonicalNpc.level,
    };

    for (const cat of npcDrops.categories) {
      const isSpoil = cat.categoryId === -1;
      const target = isSpoil ? itemSpoiledBy : itemDroppedBy;

      for (const drop of cat.drops) {
        const dedupKey = `${canonicalId}|${drop.min ?? ""}|${drop.max ?? ""}|${drop.chance ?? ""}`;
        const index = isSpoil ? spoiledByIndex : droppedByIndex;
        let seenMap = index.get(drop.itemId);
        if (!seenMap) {
          seenMap = new Map();
          index.set(drop.itemId, seenMap);
        }
        const existing = seenMap.get(dedupKey);
        if (existing) {
          existing.rollCount++;
          continue;
        }

        const entry: ItemSourceEntry = {
          npc: npcSummary,
          entry: {
            min: drop.min,
            max: drop.max,
            chance: drop.chance,
            category: cat.categoryId,
          },
          rollCount: 1,
        };
        seenMap.set(dedupKey, entry);
        let list = target.get(drop.itemId);
        if (!list) {
          list = [];
          target.set(drop.itemId, list);
        }
        list.push(entry);
      }
    }
  }



  // SA (Special Ability) weapon variant index. SA variants are named
  // "{Base Name} - {SA Suffix}". We split on " - ", look up the base
  // weapon by exact name (with an apostrophe-stripped fallback for
  // Heaven's Divider / Heavens Divider-style source-data inconsistency),
  // and dedup variants by name per base — some SAs have both a C4
  // legacy (4xxx id) and an Interlude augment (5xxx id) record; we keep
  // the richer one so the UI renders each SA once.
  const saVariantsByBaseId = new Map<number, number[]>();
  const saBaseByVariantId = new Map<number, number>();
  const itemsByName = new Map<number, Item>();
  const weaponNameIndex = new Map<string, Item>();
  const weaponNormalizedIndex = new Map<string, Item>();
  const normalizeName = (s: string): string =>
    s.toLowerCase().replace(/['`’]/g, "");
  for (const it of dataset.items) {
    itemsByName.set(it.id, it);
    if (it.type === "weapon" && !it.name.includes(" - ")) {
      weaponNameIndex.set(it.name, it);
      const norm = normalizeName(it.name);
      if (!weaponNormalizedIndex.has(norm)) weaponNormalizedIndex.set(norm, it);
    }
  }
  const variantSignalCount = (it: Item): number => {
    let n = 0;
    if (it.itemSkill) n++;
    const p = it.properties;
    if (p) {
      if (typeof p.oncrit_skill === "string") n++;
      if (typeof p.oncast_skill === "string") n++;
      if (typeof p.mp_consume_reduce === "string") n++;
      if (typeof p.reduced_soulshot === "string") n++;
    }
    return n;
  };
  const bestVariantPerBase = new Map<number, Map<string, Item>>();
  for (const it of dataset.items) {
    if (it.type !== "weapon") continue;
    const dashIdx = it.name.indexOf(" - ");
    if (dashIdx < 0) continue;
    const baseName = it.name.slice(0, dashIdx);
    const base =
      weaponNameIndex.get(baseName) ??
      weaponNormalizedIndex.get(normalizeName(baseName));
    if (!base) continue;
    saBaseByVariantId.set(it.id, base.id);
    let perBase = bestVariantPerBase.get(base.id);
    if (!perBase) {
      perBase = new Map<string, Item>();
      bestVariantPerBase.set(base.id, perBase);
    }
    const prev = perBase.get(it.name);
    if (!prev) {
      perBase.set(it.name, it);
    } else {
      const prevScore = variantSignalCount(prev);
      const curScore = variantSignalCount(it);
      if (curScore > prevScore || (curScore === prevScore && it.id > prev.id)) {
        perBase.set(it.name, it);
      }
    }
  }
  for (const [baseId, perBase] of bestVariantPerBase) {
    saVariantsByBaseId.set(
      baseId,
      [...perBase.values()].map((v) => v.id)
    );
  }

  const publicItems = dataset.items.filter(
    (it) => !saBaseByVariantId.has(it.id)
  );

  // Recipe indexes
  const recipeByRecipeItemId = new Map<number, Recipe>();
  const recipesByProductItemId = new Map<number, Recipe[]>();
  for (const r of dataset.recipes) {
    recipeByRecipeItemId.set(r.recipeItemId, r);
    let list = recipesByProductItemId.get(r.productItemId);
    if (!list) {
      list = [];
      recipesByProductItemId.set(r.productItemId, list);
    }
    list.push(r);
  }

  // Armor-set indexes
  const armorSetsById = new Map<number, ArmorSet>();
  const armorSetsByItemId = new Map<number, ArmorSet[]>();
  for (const set of dataset.armorSets) {
    armorSetsById.set(set.id, set);
    const slotIds = [
      set.pieces.chest,
      set.pieces.legs,
      set.pieces.head,
      set.pieces.gloves,
      set.pieces.feet,
      set.shield?.itemId,
    ];
    for (const itemId of slotIds) {
      if (itemId == null) continue;
      let list = armorSetsByItemId.get(itemId);
      if (!list) {
        list = [];
        armorSetsByItemId.set(itemId, list);
      }
      list.push(set);
    }
  }

  // Skill index
  const skillByKey = new Map<string, Skill>();
  for (const s of dataset.skills) {
    skillByKey.set(`${s.id}-${s.level}`, s);
  }

  return {
    items: dataset.items,
    rawNpcs: dataset.npcs,
    rawMonsters,
    cleanedNpcs: cleanedResult.cleaned,
    cleanedMonsters,
    itemsById: new Map(dataset.items.map((i) => [i.id, i])),
    rawNpcsById: new Map(dataset.npcs.map((n) => [n.id, n])),
    cleanedNpcsById: cleanedResult.cleanedById,
    mergedIdToCanonicalId: cleanedResult.mergedIdToCanonicalId,
    rawDropsByNpcId,
    cleanedDropsById: cleanedResult.cleanedDropsById,
    npcTypeMap,
    npcTypeSummary,
    itemTypeSummary,
    itemGradeSummary,
    itemDroppedBy,
    itemSpoiledBy,
    rawSpawnsByNpcId,
    cleanedSpawnsById: cleanedResult.cleanedSpawnsById,
    saVariantsByBaseId,
    saBaseByVariantId,
    publicItems,
    recipes: dataset.recipes,
    recipeByRecipeItemId,
    recipesByProductItemId,
    armorSets: dataset.armorSets,
    armorSetsById,
    armorSetsByItemId,
    skillByKey,
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

// --- ID lookups (cleaned layer — default) ---

export function getItemById(
  chronicle: Chronicle,
  id: number
): Item | undefined {
  return getChronicleIndexes(chronicle).itemsById.get(id);
}

/**
 * Cleaned NPC by any id. Accepts either the canonical id or any merged raw
 * id of a cleaned NPC — both resolve to the same cleaned record.
 */
export function getNpcById(
  chronicle: Chronicle,
  id: number
): Npc | undefined {
  const idx = getChronicleIndexes(chronicle);
  const canonicalId = idx.mergedIdToCanonicalId.get(id);
  if (canonicalId === undefined) return undefined;
  return idx.cleanedNpcsById.get(canonicalId);
}

/**
 * Cleaned monster by any id — same forgiving resolution as {@link getNpcById},
 * additionally gated on the resolved NPC having a monster-type `npcType`. An
 * id that resolves to a non-monster NPC (e.g. a Folk merchant) returns
 * `undefined`.
 */
export function getMonsterById(
  chronicle: Chronicle,
  id: number
): Npc | undefined {
  const npc = getNpcById(chronicle, id);
  if (!npc || npc.npcType === null) return undefined;
  return MONSTER_NPC_TYPES.has(npc.npcType) ? npc : undefined;
}

// --- ID lookups (raw layer — source-faithful) ---

/** Raw NPC by its source-faithful id. Every raw row is directly reachable. */
export function getRawNpcById(
  chronicle: Chronicle,
  id: number
): Npc | undefined {
  return getChronicleIndexes(chronicle).rawNpcsById.get(id);
}

/**
 * Raw monster by its source-faithful id. Same monster-type gate as
 * {@link getMonsterById}; returns `undefined` for non-monster NPC ids.
 */
export function getRawMonsterById(
  chronicle: Chronicle,
  id: number
): Npc | undefined {
  const npc = getRawNpcById(chronicle, id);
  if (!npc || npc.npcType === null) return undefined;
  return MONSTER_NPC_TYPES.has(npc.npcType) ? npc : undefined;
}

// --- Drops & spawns ---

/**
 * Cleaned drops for a given id. Accepts canonical id or any merged raw id;
 * the response is the union of drops across every mergedId, deduped on
 * `(categoryId, itemId, min, max, chance)`.
 */
export function getDropsByNpcId(
  chronicle: Chronicle,
  npcId: number
): NpcDrops | undefined {
  const idx = getChronicleIndexes(chronicle);
  const canonicalId = idx.mergedIdToCanonicalId.get(npcId);
  if (canonicalId === undefined) return undefined;
  return idx.cleanedDropsById.get(canonicalId);
}

/**
 * Cleaned spawns for a given id. Accepts canonical id or any merged raw id;
 * returns the union across mergedIds, deduped on the full position tuple.
 * Returns an empty array when the NPC exists but has no spawns.
 */
export function getNpcSpawns(chronicle: Chronicle, npcId: number): Spawn[] {
  const idx = getChronicleIndexes(chronicle);
  const canonicalId = idx.mergedIdToCanonicalId.get(npcId);
  if (canonicalId === undefined) return [];
  return idx.cleanedSpawnsById.get(canonicalId) ?? [];
}

/** Raw spawns for a specific raw npcId. No aggregation, no resolution. */
export function getRawNpcSpawns(chronicle: Chronicle, npcId: number): Spawn[] {
  return getChronicleIndexes(chronicle).rawSpawnsByNpcId.get(npcId) ?? [];
}

/**
 * Reverse lookup: which cleaned NPCs drop this item (normal drops,
 * category != -1). Every entry's `npc.id` is a canonical id.
 */
export function getItemDroppedBy(
  chronicle: Chronicle,
  itemId: number
): ItemSourceEntry[] {
  return getChronicleIndexes(chronicle).itemDroppedBy.get(itemId) ?? [];
}

/**
 * Reverse lookup: which cleaned NPCs spoil this item (category == -1).
 * Every entry's `npc.id` is a canonical id.
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
  const all = getChronicleIndexes(chronicle).publicItems;
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

/** Cleaned NPC list — one entry per unique name. Default for `/api/.../npcs`. */
export function getNpcs(
  chronicle: Chronicle,
  options: NpcListOptions
): ListResult<Npc> {
  return listNpcsFrom(getChronicleIndexes(chronicle).cleanedNpcs, options);
}

/** Cleaned monster list — `getNpcs` filtered to monster npcTypes. */
export function getMonsters(
  chronicle: Chronicle,
  options: NpcListOptions
): ListResult<Npc> {
  return listNpcsFrom(getChronicleIndexes(chronicle).cleanedMonsters, options);
}

/** Raw NPC list — source-faithful, every raw row preserved. */
export function getRawNpcs(
  chronicle: Chronicle,
  options: NpcListOptions
): ListResult<Npc> {
  return listNpcsFrom(getChronicleIndexes(chronicle).rawNpcs, options);
}

/** Raw monster list — `getRawNpcs` filtered to monster npcTypes. */
export function getRawMonsters(
  chronicle: Chronicle,
  options: NpcListOptions
): ListResult<Npc> {
  return listNpcsFrom(getChronicleIndexes(chronicle).rawMonsters, options);
}

// --- SA (Special Ability) weapon variant lookups ---

/** Returns the SA variant item ids for a base weapon, or `undefined` if none. */
export function getSaVariants(
  chronicle: Chronicle,
  baseItemId: number
): number[] | undefined {
  return getChronicleIndexes(chronicle).saVariantsByBaseId.get(baseItemId);
}

/** Returns the base weapon id for an SA variant, or `undefined` if not a variant. */
export function getSaBaseWeaponId(
  chronicle: Chronicle,
  variantItemId: number
): number | undefined {
  return getChronicleIndexes(chronicle).saBaseByVariantId.get(variantItemId);
}

// --- Recipe lookups ---

/** Returns the recipe for a given recipe item id (the "scroll"). */
export function getRecipeByItemId(
  chronicle: Chronicle,
  recipeItemId: number
): Recipe | undefined {
  return getChronicleIndexes(chronicle).recipeByRecipeItemId.get(recipeItemId);
}

/** Returns recipes that produce the given product item id. */
export function getRecipesByProductId(
  chronicle: Chronicle,
  productItemId: number
): Recipe[] {
  return (
    getChronicleIndexes(chronicle).recipesByProductItemId.get(productItemId) ??
    []
  );
}

// --- Skill lookups ---

/** Returns a skill by its `"id-level"` key (matches `itemSkill` format). */
export function getSkillByKey(
  chronicle: Chronicle,
  key: string
): Skill | undefined {
  return getChronicleIndexes(chronicle).skillByKey.get(key);
}

// --- Armor-set lookups ---

export interface ArmorSetListOptions {
  q?: string | null;
  limit: number;
  offset: number;
}

/** Returns an armor set by its synthetic id, or `undefined`. */
export function getArmorSetById(
  chronicle: Chronicle,
  id: number
): ArmorSet | undefined {
  return getChronicleIndexes(chronicle).armorSetsById.get(id);
}

/**
 * Returns paginated armor sets, optionally filtered by case-insensitive
 * name substring (`q`). Total reflects the filtered count.
 */
export function getArmorSets(
  chronicle: Chronicle,
  options: ArmorSetListOptions
): ListResult<ArmorSet> {
  const all = getChronicleIndexes(chronicle).armorSets;
  const q = options.q?.trim().toLowerCase() || null;
  const filtered = q ? all.filter((s) => matchesQuery(s.name, q)) : all;
  return {
    data: paginate(filtered, options.limit, options.offset),
    total: filtered.length,
  };
}

/**
 * Returns every armor set that lists the given item id as a piece (chest /
 * legs / head / gloves / feet / shield). Empty array when the item is in
 * no set. N:M by design — Tallum Helmet (547) returns three sets (Tallum
 * Heavy / Light / Robe). Order is the natural set-id order.
 */
export function getArmorSetsByItemId(
  chronicle: Chronicle,
  itemId: number
): ArmorSet[] {
  return (
    getChronicleIndexes(chronicle).armorSetsByItemId.get(itemId) ?? []
  );
}

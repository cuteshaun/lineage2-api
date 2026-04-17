export interface DataSource {
  project: "acis";
  chronicle: "interlude";
  file: string;
}

/** @deprecated Use DataSource instead */
export type ItemSource = DataSource;

export interface Item {
  id: number;
  name: string;
  type: string; // weapon | armor | etcitem
  grade: string; // none | d | c | b | a | s
  weight: number | null;
  price: number | null;
  material: string | null;
  bodypart: string | null;
  weaponType: string | null;
  armorType: string | null;
  etcItemType: string | null;
  defaultAction: string | null;
  isStackable: boolean | null;
  isTradable: boolean | null;
  isDropable: boolean | null;
  isSellable: boolean | null;
  soulshots: number | null;
  spiritshots: number | null;
  mpConsume: number | null;
  reuseDelay: number | null;
  itemSkill: string | null;
  isMagical: boolean | null;
  crystalCount: number | null;
  handler: string | null;
  pAtk: number | null;
  mAtk: number | null;
  pDef: number | null;
  mDef: number | null;
  rCrit: number | null;
  pAtkSpd: number | null;
  rShld: number | null;
  sDef: number | null;
  accCombat: number | null;
  rEvas: number | null;
  source: DataSource;
  /**
   * Client-side icon key from the L2 Interlude `*grp.dat` tables (e.g.
   * `"etc_adena_i00"`, `"weapon_small_sword_i00"`). `null` when no record
   * was found for this itemId in any grp file. Not guessed or fuzzy-matched.
   */
  iconName: string | null;
  /**
   * Resolved PNG basename inside `public/icons/` (e.g. `"etc_adena_i00.png"`).
   * `null` when `iconName` is null, or when no matching file exists on disk.
   * Consumers build URLs as `/icons/${iconFile}`.
   */
  iconFile: string | null;
  properties?: Record<string, string | number | boolean>;
  stats?: Record<string, number>;
}

export interface NpcSkill {
  id: number;
  level: number;
}

export interface PetDataStat {
  level: number;
  maxMeal: number | null;
  exp: number | null;
  expType: number | null;
  mealInBattle: number | null;
  mealInNormal: number | null;
  pAtk: number | null;
  pDef: number | null;
  mAtk: number | null;
  mDef: number | null;
  hp: number | null;
  mp: number | null;
  hpRegen: number | null;
  mpRegen: number | null;
  ssCount: number | null;
  spsCount: number | null;
}

export interface PetData {
  food1: number | null;
  food2: number | null;
  autoFeedLimit: number | null;
  hungryLimit: number | null;
  unsummonLimit: number | null;
  stats: PetDataStat[];
}

export interface Npc {
  id: number;
  /**
   * Raw NPC ids folded into this record by the cleaned layer (includes `id`).
   * Always sorted ascending, length >= 1. For a raw `Npc` it is always `[id]`;
   * for a cleaned `Npc` it is the full set of same-name raw ids. Kept on every
   * `Npc` so every consumer sees a uniform shape regardless of layer.
   */
  mergedIds: number[];
  /** `mergedIds.length`. Cheap `>1` check without touching the array. */
  mergedCount: number;
  name: string;
  title: string | null;

  level: number | null;
  npcType: string | null;

  radius: number | null;
  height: number | null;
  rHand: number | null;
  lHand: number | null;

  exp: number | null;
  sp: number | null;

  hp: number | null;
  mp: number | null;
  hpRegen: number | null;
  mpRegen: number | null;

  pAtk: number | null;
  pDef: number | null;
  mAtk: number | null;
  mDef: number | null;
  crit: number | null;
  atkSpd: number | null;

  str: number | null;
  int: number | null;
  dex: number | null;
  wit: number | null;
  con: number | null;
  men: number | null;

  corpseTime: number | null;
  walkSpd: number | null;
  runSpd: number | null;
  dropHerbGroup: number | null;

  aiType: string | null;
  aiAggro: number | null;
  aiCanMove: boolean | null;
  aiSeedable: boolean | null;
  aiSsCount: number | null;
  aiSsRate: number | null;
  aiSpsCount: number | null;
  aiSpsRate: number | null;

  skills: NpcSkill[];
  petData: PetData | null;

  source: DataSource;

  properties?: Record<string, string | number | boolean>;
}

export interface DropEntry {
  itemId: number;
  min: number | null;
  max: number | null;
  chance: number | null;
}

export interface NpcDropCategory {
  categoryId: number | null;
  drops: DropEntry[];
}

export interface NpcDrops {
  npcId: number;
  npcName: string;
  categories: NpcDropCategory[];
  source: DataSource;
}

/**
 * Raw spawn point from the upstream `spawnlist.sql` dataset. One record
 * per row in that table — no grouping, no dedup, no location enrichment.
 * Intended to be attached to a raw NPC id later (each `npcId` can have
 * many spawns). `periodOfDay` kept numeric (0/1/2 in the source) for now;
 * semantic naming is a future iteration.
 */
export interface Spawn {
  npcId: number;
  x: number;
  y: number;
  z: number;
  heading: number;
  respawnDelay: number;
  respawnRandom: number;
  periodOfDay: number;
}

export interface RecipeIngredient {
  itemId: number;
  count: number;
}

export interface Recipe {
  id: number;
  recipeItemId: number;
  productItemId: number;
  productCount: number;
  ingredients: RecipeIngredient[];
  successRate: number;
  level: number;
  mpConsume: number;
  isDwarven: boolean;
}

export interface ManualFixes {
  items: Record<string, Partial<Item>>;
  npcs: Record<string, Partial<Npc>>;
  drops: Record<string, Partial<NpcDrops>>;
}

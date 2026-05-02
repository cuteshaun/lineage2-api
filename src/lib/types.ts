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

/**
 * An aCis armor-set definition (e.g. "Tallum Heavy Set").
 *
 * The source XML (`data/xml/armorSets.xml`) carries no explicit set id —
 * sets are identified only by name, with one known name collision
 * ("Mithril Robe Set" appears twice). At parse time we synthesize a
 * stable position-based id (1..N over the file).
 *
 * Bonuses are entirely **skill references** (`"id-level"` strings
 * matching the convention used by `Item.itemSkill`). The actual
 * description text and numeric magnitudes live on the resolved skill
 * record, so DTO-time resolution reuses the existing `resolveSkill`
 * machinery — no parallel infrastructure.
 *
 * Slots whose XML attribute is `0` (meaning "no piece in this slot is
 * required for the set bonus") are dropped at parse time rather than
 * stored as `0` sentinels.
 */
export interface ArmorSet {
  /** Synthetic, position-based id assigned at parse time (1..N). */
  id: number;
  /** Set name from the XML, e.g. `"Tallum Heavy Set"`. May collide. */
  name: string;
  /**
   * Required item ids per equipment slot. `chest` is always present
   * (every entry in the source XML has a non-zero chest). Other slots
   * are present only when the source has a non-zero value for that slot.
   */
  pieces: {
    chest: number;
    legs?: number;
    head?: number;
    gloves?: number;
    feet?: number;
  };
  /** Main set bonus, always present. `"id-level"` reference. */
  bonusSkill: string;
  /**
   * Shield piece + the extra skill granted when the shield is also
   * equipped. Present only when the source has both `shield != 0` and
   * `shieldSkillId != 0`.
   */
  shield?: {
    itemId: number;
    bonusSkill: string;
  };
  /**
   * Extra skill granted when any piece in the set reaches +6 enchant.
   * `"id-level"` reference. Present only when the source has a non-zero
   * `enchant6Skill` attribute.
   */
  enchant6BonusSkill?: string;
}

/**
 * Player class (race/profession). Metadata (id, name, race, type, parent,
 * professionLevel) is sourced from the canonical `ClassId.java` enum;
 * skill-learn entries come from the per-race XML files in
 * `data/xml/classes/`. Only Interlude classes are present (no Kamael,
 * no 4th profession).
 */
export interface ClassRecord {
  /** Canonical class id (matches `ClassId.java` ordinal). */
  id: number;
  /** Display name from the enum (e.g. "Human Fighter", "Phoenix Knight"). */
  name: string;
  /** "Human" | "Elf" | "Dark Elf" | "Orc" | "Dwarf". Normalized from the Java enum. */
  race: string;
  /** "Fighter" | "Mystic" | "Priest". Normalized from the Java enum. */
  type: string;
  /** 0 = base, 1 = 1st profession, 2 = 2nd profession, 3 = 3rd profession. */
  professionLevel: number;
  /** Parent class id, or `null` when this is a base class (level 0). */
  parentClassId: number | null;
  /** Skills the class can learn, sorted by skillId then skillLevel. */
  skills: ClassSkillLearn[];
}

/** One skill the class learns at a given player level for an SP cost. */
export interface ClassSkillLearn {
  skillId: number;
  skillLevel: number;
  /** Minimum player level required to learn the skill. */
  minPlayerLevel: number;
  /** Skill point cost. */
  spCost: number;
}

/**
 * One spellbook -> skill mapping from `data/xml/spellbooks.xml`. The
 * presence of an entry means consuming the item teaches the skill.
 * Skill levels are not differentiated in the source data — one item
 * teaches all levels of the skill.
 */
export interface Spellbook {
  skillId: number;
  itemId: number;
}

/**
 * Aggregated reward block for a quest. Items, adena, exp, sp are
 * extracted from the Java script via lexical-proximity to
 * `exitQuest(...)` calls — see `scripts/parse-quests.ts`. Values
 * are `null` when the script doesn't grant that resource on
 * completion. `items` is always an array (empty when none).
 */
export interface QuestRewards {
  items: Array<{ itemId: number; count: number }>;
  adena: number | null;
  exp: number | null;
  sp: number | null;
}

/**
 * One quest extracted from an aCis Java quest script. Metadata only —
 * walkthrough text, narrative description, and HTML dialogue are NOT
 * included (the latter stays internal; the former two require the
 * client-side `questname-e.dat` enrichment that lands in M3B).
 */
export interface Quest {
  /** Quest id from `super(id, "name")`. Range 1..N. */
  id: number;
  /** Quest name from the `super` constructor. */
  name: string;
  /** Source filename for traceability, e.g. `"Q001_LettersOfLove.java"`. */
  scriptFile: string;
  /** Min player level inferred from `getLevel() < N` checks in STATE_CREATED. `null` when no check is found. */
  levelMin: number | null;
  /** From `exitQuest(true|false)`. `null` when the script never calls `exitQuest` (rare; treat as one-time). */
  repeatable: boolean | null;
  /**
   * Race symbols from `player.getRace() ==/!= ClassRace.X` checks.
   * Canonical aCis enum names ("HUMAN", "ELF", "DARK_ELF", "ORC",
   * "DWARF"). Empty when no race gate is encoded.
   */
  raceRestrictions: string[];
  /**
   * Class ids from `getClassId() ==/!=/equalsOrChildOf ClassId.X`
   * checks, resolved against `classes.json`. Empty when no class
   * gate is encoded.
   */
  classRestrictions: number[];
  /** From `addStartNpc(...)` — typically 1, plural for the rare multi-start case. */
  startNpcIds: number[];
  /** From `addTalkId(...)`. Deduped. */
  talkNpcIds: number[];
  /** From `addKillId(...)`. Deduped. */
  killNpcIds: number[];
  /**
   * From `setItemsIds(...)` declared at the top of the constructor.
   * Engine list of every item the quest registers (transient + final);
   * count is not encoded here so the public DTO surfaces these as
   * `count=0` for shape parity with `ItemQuantityDto`.
   */
  questItemIds: number[];
  rewards: QuestRewards;
}

/**
 * One named L2 region (e.g. "Talking Island Village", "Town of Aden")
 * extracted from `data/xml/mapRegions.xml`. Ids are 0..18 for
 * Interlude (19 entries) and indexed densely. The id matches the
 * upstream engine's region id, so consumers can cross-reference
 * with other aCis docs / scripts that quote the same numeric id.
 */
export interface Region {
  id: number;
  name: string;
}

/**
 * Sparse tile grid mapping `(rX, rY)` array indices to a region id
 * (or `-1` when the cell is unmapped). Coordinate-to-tile conversion
 * matches `MapRegionData.java`:
 *
 *   rX = (worldX >> 15) + originX   // originX = 4 for Interlude
 *   rY = (worldY >> 15) + originY   // originY = 8 for Interlude
 *
 * `cells` is a flat row-major array of length `width * height`,
 * indexed by `rY * width + rX`. Out-of-grid coordinates and `-1`
 * cells both resolve to `null` at the public API layer — there
 * is no synthetic "Unknown" region.
 */
export interface RegionGrid {
  originX: number;
  originY: number;
  width: number;
  height: number;
  cells: number[];
}

/**
 * Composite artifact written to `data/generated/<chronicle>/regions.json`.
 * Loaded as a unit by the runtime so the names and the grid stay
 * consistent (a parser-time mismatch fails the build, never reaches
 * the runtime).
 */
export interface RegionsArtifact {
  regions: Region[];
  grid: RegionGrid;
}

/**
 * Per-quest narrative metadata extracted from the L2 client's
 * `questname-e.dat`. Keyed by the same `id` as `Quest`. Optional —
 * a chronicle that doesn't declare `questNameDatFile` produces no
 * records, in which case `QuestDetailDto.description` is simply
 * absent.
 *
 * Currently only the player-facing overview is surfaced. The DAT
 * also carries per-step prose, race/class label strings, and
 * client-only quest stubs without Java counterparts; none of those
 * are exposed in M3B (see plan). Adding fields later is additive.
 */
export interface QuestNameRecord {
  /** Quest id matching `Quest.id`. Joins are id-only, never by name. */
  id: number;
  /**
   * Replicated overview prose ("Darin, a young man on Talking Island,
   * carries a torch for Gatekeeper Roxxy..."). Always non-empty —
   * empty overviews are dropped at parse time.
   */
  description: string;
}

/**
 * One product offered by a merchant via the buyLists system. Pure
 * adena-for-item: currency is implicitly Adena (item id 57), no
 * exchange semantics, no enchant preservation.
 */
export interface BuyListProduct {
  itemId: number;
  /** Adena cost. Currency is always Adena (id 57) for buyLists. */
  price: number;
}

/**
 * One merchant inventory from `buyLists.xml`. A given NPC can have
 * multiple buyLists (e.g. Pinter has separate lists for grade
 * categories). Source format:
 * `<buyList id="N" npcId="M"><product id, price/>...</buyList>`
 */
export interface BuyList {
  id: number;
  npcId: number;
  products: BuyListProduct[];
}

/**
 * One row of a multisell list — a single fixed exchange of N
 * ingredients for 1 production. Mammon (5 files) plus a curated
 * allow-list of additional shop/exchange multisells (B-grade
 * seal/unseal, Luxury Shop, Apella Trader) are parsed today; all
 * carry exactly one production per `<item>` block.
 */
export interface MultisellEntry {
  ingredients: Array<{ itemId: number; count: number }>;
  production: { itemId: number; count: number };
}

/**
 * One multisell file, e.g. `data/xml/multisell/311262506.xml`
 * (Blacksmith of Mammon — Unseal A-Grade Armor). Only the
 * Mammon-scoped subset is parsed at build time; broader multisell
 * support (regular shops, dye merchants, etc.) is deliberately out
 * of scope.
 */
export interface Multisell {
  /** Source filename id. */
  id: number;
  /**
   * NPC ids that offer this multisell, parsed from the file's `<npcs>`
   * block. Always at least one entry (the parser rejects files with no
   * `<npcs>` block since the npc->multisell join would otherwise be
   * ambiguous).
   */
  npcIds: number[];
  /** Whether the production preserves the ingredient's enchant level. */
  maintainEnchantment: boolean;
  entries: MultisellEntry[];
}

export interface SkillEffect {
  stat: string;
  op: "mul" | "add";
  value: number;
}

export interface Skill {
  id: number;
  level: number;
  name: string;
  operateType: string | null;
  magicLevel: number | null;
  mpConsume: number | null;
  castRange: number | null;
  hitTime: number | null;
  reuseDelay: number | null;
  isMagic: boolean | null;
  target: string | null;
  iconFile: string | null;
  description: string | null;
  /**
   * Raw `power` value resolved from the skill's `<set name="power">` entry
   * (literal or `#table`-referenced per level). Semantic meaning depends
   * on `skillType`: for DRAIN it's HP absorbed per crit, for MDAM it's a
   * magic-damage multiplier, etc. Nullable when the XML omits the field.
   */
  power: number | null;
  /**
   * Raw `skillType` attribute (DRAIN / MDAM / BUFF / DEBUFF / …). Used at
   * the DTO layer to compose player-facing descriptions for trigger skills
   * whose `skillname-e.dat` description is `"none"`.
   */
  skillType: string | null;
  effects?: SkillEffect[];
}

export interface ManualFixes {
  items: Record<string, Partial<Item>>;
  npcs: Record<string, Partial<Npc>>;
  drops: Record<string, Partial<NpcDrops>>;
}

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

export interface ManualFixes {
  items: Record<string, Partial<Item>>;
  npcs: Record<string, Partial<Npc>>;
  drops: Record<string, Partial<NpcDrops>>;
}

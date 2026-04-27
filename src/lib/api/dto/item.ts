import type { Chronicle } from "../../chronicles";
import type { Item } from "../../types";
import {
  getArmorSetsByItemId,
  getItemById,
  getSaVariants,
  getSaBaseWeaponId,
  getRecipeByItemId,
  getRecipesByProductId,
} from "../../data/indexes";
import { resolveSkill, type SkillSummaryDto } from "./skill";
import {
  toArmorSetDetailDto,
  type ArmorSetDetailDto,
} from "./armor-set";

export type { SkillSummaryDto };

export interface SaVariantDto {
  itemId: number;
  name: string;
  saName: string;
  iconFile: string | null;
  effectChance: number | null;
  skills: SkillSummaryDto[];
  saveMechanic?: { kind: "mp" | "soulshot"; chance: number; amount: number };
  /**
   * Stat delta derived from comparing the variant item to its base weapon.
   * Used for SAs whose effect is baked into the item's own stats rather
   * than a runtime skill — Light (reduces weight), Quick Recovery
   * (reduces reuse delay). The `deltaPercent` is signed (negative = reduction).
   */
  statDelta?: {
    stat: "weight" | "reuseDelay";
    deltaPercent: number;
    display: string;
  };
}

export interface CraftingIngredientDto {
  itemId: number;
  name: string;
  count: number;
  iconFile: string | null;
}

export interface CraftingInfoDto {
  productItemId: number;
  productName: string;
  productCount: number;
  productIconFile: string | null;
  ingredients: CraftingIngredientDto[];
  successRate: number;
  level: number;
  mpConsume: number;
  isDwarven: boolean;
}

export interface CraftedByDto {
  recipeItemId: number;
  recipeName: string;
  successRate: number;
}

export interface ItemListDto {
  id: number;
  name: string;
  type: string;
  grade: string;
  weight: number | null;
  price: number | null;
  iconFile: string | null;
}

export interface ItemDetailDto {
  id: number;
  name: string;
  type: string;
  grade: string;
  weight: number | null;
  price: number | null;
  material: string | null;
  bodypart: string | null;
  weaponType: string | null;
  armorType: string | null;
  etcItemType: string | null;
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
  iconFile: string | null;
  skill?: SkillSummaryDto;
  specialAbilityOptions?: SaVariantDto[];
  /**
   * Shared PvP damage bonus conferred by any soul-crystal augmentation on
   * A/S-grade weapons. Present whenever `specialAbilityOptions` is non-empty
   * and the base weapon is A- or S-grade. Surfaced at the DTO layer because
   * it's an engine rule (applies weapon-wide) rather than per-skill data,
   * which some legacy SA slots fail to carry due to stub/placeholder entries.
   */
  pvpBonus?: { damageMultiplier: number; display: string };
  baseWeaponId?: number;
  crafting?: CraftingInfoDto;
  craftedBy?: CraftedByDto[];
  /**
   * Every armor set that lists this item as a piece. Plural by design —
   * one item (e.g. Tallum Helmet) can belong to several sets (Heavy /
   * Light / Robe). Omitted when the item is in no set.
   */
  partOfSets?: ArmorSetDetailDto[];
}

const BODYPART_LABELS: Record<string, string> = {
  rhand: "One-handed",
  lrhand: "Two-handed",
  lhand: "Off-hand",
  chest: "Chest",
  fullarmor: "Full Armor",
  legs: "Legs",
  head: "Helmet",
  gloves: "Gloves",
  feet: "Boots",
  neck: "Necklace",
  "rear;lear": "Earring",
  "rfinger;lfinger": "Ring",
  underwear: "Underwear",
  hair: "Hair Accessory",
  hairall: "Hair Accessory",
  face: "Face Accessory",
  alldress: "Full Dress",
};

function normalizeBodypart(raw: string | null): string | null {
  if (raw == null) return null;
  return BODYPART_LABELS[raw] ?? raw;
}

export function toItemListDto(item: Item): ItemListDto {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    grade: item.grade,
    weight: item.weight,
    price: item.price,
    iconFile: item.iconFile,
  };
}

/**
 * Derive a stat delta for SAs whose mechanic is encoded directly on the
 * variant item's own stats (rather than via a runtime skill effect).
 * Compares the variant to its base weapon and reports the signed percent
 * change of the relevant stat. Returns `undefined` if the SA isn't one
 * of the known stat-delta flavors or if the comparison isn't possible.
 */
function deriveStatDelta(
  variant: Item,
  base: Item,
  saName: string
): SaVariantDto["statDelta"] {
  let stat: "weight" | "reuseDelay" | null = null;
  let label: string;
  if (saName === "Light") {
    stat = "weight";
    label = "Weight";
  } else if (saName === "Quick Recovery") {
    stat = "reuseDelay";
    label = "Reuse Delay";
  } else {
    return undefined;
  }
  const variantVal = variant[stat];
  const baseVal = base[stat];
  if (variantVal == null || baseVal == null || baseVal === 0) return undefined;
  const deltaPercent = Math.round((variantVal / baseVal - 1) * 100);
  if (deltaPercent === 0) return undefined;
  return {
    stat,
    deltaPercent,
    display: `${deltaPercent > 0 ? "+" : ""}${deltaPercent}% ${label}`,
  };
}

function parseSaveMechanic(
  props: Record<string, string | number | boolean>
): SaVariantDto["saveMechanic"] {
  for (const [prop, kind] of [
    ["mp_consume_reduce", "mp"],
    ["reduced_soulshot", "soulshot"],
  ] as const) {
    const raw = props[prop];
    if (typeof raw !== "string") continue;
    const [c, a] = raw.split(",");
    const chance = Number(c);
    const amount = Number(a);
    if (!Number.isFinite(chance) || !Number.isFinite(amount)) continue;
    return { kind, chance, amount };
  }
  return undefined;
}

export function toItemDetailDto(
  item: Item,
  chronicle: Chronicle
): ItemDetailDto {
  const dto: ItemDetailDto = {
    id: item.id,
    name: item.name,
    type: item.type,
    grade: item.grade,
    weight: item.weight,
    price: item.price,
    material: item.material,
    bodypart: normalizeBodypart(item.bodypart),
    weaponType: item.weaponType,
    armorType: item.armorType,
    etcItemType: item.etcItemType,
    isStackable: item.isStackable,
    isTradable: item.isTradable,
    isDropable: item.isDropable,
    isSellable: item.isSellable,
    soulshots: item.soulshots,
    spiritshots: item.spiritshots,
    mpConsume: item.mpConsume,
    reuseDelay: item.reuseDelay,
    itemSkill: item.itemSkill,
    isMagical: item.isMagical,
    crystalCount: item.crystalCount,
    pAtk: item.pAtk,
    mAtk: item.mAtk,
    pDef: item.pDef,
    mDef: item.mDef,
    rCrit: item.rCrit,
    pAtkSpd: item.pAtkSpd,
    rShld: item.rShld,
    sDef: item.sDef,
    accCombat: item.accCombat,
    rEvas: item.rEvas,
    iconFile: item.iconFile,
  };

  const skillSummary = resolveSkill(chronicle, item.itemSkill);
  if (skillSummary) dto.skill = skillSummary;

  const variantIds = getSaVariants(chronicle, item.id);
  if (variantIds) {
    dto.specialAbilityOptions = variantIds
      .map((vid) => {
        const v = getItemById(chronicle, vid);
        if (!v) return null;
        const dashIdx = v.name.indexOf(" - ");
        const props = v.properties ?? {};
        const oncritSkillRef =
          typeof props.oncrit_skill === "string" ? props.oncrit_skill : null;
        const oncastSkillRef =
          typeof props.oncast_skill === "string" ? props.oncast_skill : null;
        const effectChance =
          typeof props.oncrit_chance === "number"
            ? props.oncrit_chance
            : typeof props.oncast_chance === "number"
              ? props.oncast_chance
              : null;

        const skills: SkillSummaryDto[] = [];
        const seen = new Set<string>();
        const itemSkillRefs = v.itemSkill
          ? v.itemSkill.split(";").map((s) => s.trim()).filter(Boolean)
          : [];
        for (const ref of [...itemSkillRefs, oncritSkillRef, oncastSkillRef]) {
          const resolved = resolveSkill(chronicle, ref);
          if (!resolved) continue;
          const key = `${resolved.id}-${resolved.level}`;
          if (seen.has(key)) continue;
          seen.add(key);
          skills.push(resolved);
        }

        const saveMechanic = parseSaveMechanic(props);
        const saName = dashIdx >= 0 ? v.name.slice(dashIdx + 3) : v.name;
        const statDelta = deriveStatDelta(v, item, saName);

        return {
          itemId: v.id,
          name: v.name,
          saName,
          iconFile: v.iconFile,
          effectChance,
          skills,
          ...(saveMechanic ? { saveMechanic } : {}),
          ...(statDelta ? { statDelta } : {}),
        };
      })
      .filter((x): x is SaVariantDto => x !== null);
  }

  // Soul-crystal augmentation always confers a +5% PvP damage bonus on
  // A- and S-grade weapons, regardless of which SA slot is attached.
  // Surfaced as an engine-rule DTO field so the UI doesn't need to rely on
  // every per-skill effects array containing the triple — some legacy/stub
  // SA entries (e.g. Carnage Bow's Quick Recovery) don't carry it in data.
  if (
    item.type === "weapon" &&
    (item.grade === "s" || item.grade === "a") &&
    dto.specialAbilityOptions &&
    dto.specialAbilityOptions.length > 0
  ) {
    dto.pvpBonus = { damageMultiplier: 1.05, display: "+5% PvP Damage" };
  }

  const baseId = getSaBaseWeaponId(chronicle, item.id);
  if (baseId !== undefined) {
    dto.baseWeaponId = baseId;
  }

  // Recipe: this item IS a recipe scroll → attach what it crafts
  const recipe = getRecipeByItemId(chronicle, item.id);
  if (recipe) {
    const product = getItemById(chronicle, recipe.productItemId);
    dto.crafting = {
      productItemId: recipe.productItemId,
      productName: product?.name ?? `#${recipe.productItemId}`,
      productCount: recipe.productCount,
      productIconFile: product?.iconFile ?? null,
      ingredients: recipe.ingredients.map((ing) => {
        const ingItem = getItemById(chronicle, ing.itemId);
        return {
          itemId: ing.itemId,
          name: ingItem?.name ?? `#${ing.itemId}`,
          count: ing.count,
          iconFile: ingItem?.iconFile ?? null,
        };
      }),
      successRate: recipe.successRate,
      level: recipe.level,
      mpConsume: recipe.mpConsume,
      isDwarven: recipe.isDwarven,
    };
  }

  // Crafted-by: this item is produced by one or more recipes.
  // Dedup by recipeItemId — the source XML sometimes carries duplicate
  // entries (same scroll, same product, different internal recipe id)
  // for dwarven vs common skill variants.
  const producedBy = getRecipesByProductId(chronicle, item.id);
  if (producedBy.length > 0) {
    const seen = new Set<number>();
    const entries: CraftedByDto[] = [];
    for (const r of producedBy) {
      if (seen.has(r.recipeItemId)) continue;
      seen.add(r.recipeItemId);
      const recipeItem = getItemById(chronicle, r.recipeItemId);
      entries.push({
        recipeItemId: r.recipeItemId,
        recipeName: recipeItem?.name ?? `#${r.recipeItemId}`,
        successRate: r.successRate,
      });
    }
    dto.craftedBy = entries;
  }

  // Reverse cross-link: every armor set that lists this item as a piece,
  // fully resolved (pieces with icons, bonus skills with description +
  // effects, optional shield + enchant6 bonuses). Same shape as
  // `GET /api/[chronicle]/armor-sets/[id]` so consumers can render the
  // full set in place without a second round-trip. Plural — Tallum Helmet
  // (547) belongs to 3 sets (Tallum Heavy / Light / Robe).
  const partOfSets = getArmorSetsByItemId(chronicle, item.id);
  if (partOfSets.length > 0) {
    dto.partOfSets = partOfSets.map((set) =>
      toArmorSetDetailDto(set, chronicle)
    );
  }

  return dto;
}

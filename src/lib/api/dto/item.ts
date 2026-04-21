import type { Chronicle } from "../../chronicles";
import type { Item, SkillEffect } from "../../types";
import {
  getItemById,
  getSaVariants,
  getSaBaseWeaponId,
  getRecipeByItemId,
  getRecipesByProductId,
  getSkillByKey,
} from "../../data/indexes";

export interface SkillSummaryDto {
  id: number;
  level: number;
  name: string;
  operateType: string | null;
  target: string | null;
  iconFile: string | null;
  description: string | null;
  effects?: SkillEffect[];
}

export interface SaVariantDto {
  itemId: number;
  name: string;
  saName: string;
  iconFile: string | null;
  effectChance: number | null;
  skills: SkillSummaryDto[];
  saveMechanic?: { kind: "mp" | "soulshot"; chance: number; amount: number };
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
  baseWeaponId?: number;
  crafting?: CraftingInfoDto;
  craftedBy?: CraftedByDto[];
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

function resolveSkill(
  chronicle: Chronicle,
  itemSkill: string | null
): SkillSummaryDto | undefined {
  if (!itemSkill) return undefined;
  const skill = getSkillByKey(chronicle, itemSkill);
  if (!skill) return undefined;
  const description =
    skill.description && skill.description !== "none" ? skill.description : null;
  return {
    id: skill.id,
    level: skill.level,
    name: skill.name,
    operateType: skill.operateType,
    target: skill.target,
    iconFile: skill.iconFile,
    description,
    ...(skill.effects && skill.effects.length > 0
      ? { effects: skill.effects }
      : {}),
  };
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
        for (const ref of [v.itemSkill, oncritSkillRef, oncastSkillRef]) {
          const resolved = resolveSkill(chronicle, ref);
          if (!resolved) continue;
          const key = `${resolved.id}-${resolved.level}`;
          if (seen.has(key)) continue;
          seen.add(key);
          skills.push(resolved);
        }

        const saveMechanic = parseSaveMechanic(props);

        return {
          itemId: v.id,
          name: v.name,
          saName: dashIdx >= 0 ? v.name.slice(dashIdx + 3) : v.name,
          iconFile: v.iconFile,
          effectChance,
          skills,
          ...(saveMechanic ? { saveMechanic } : {}),
        };
      })
      .filter((x): x is SaVariantDto => x !== null);
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

  return dto;
}

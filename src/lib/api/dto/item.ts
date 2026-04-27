import type { Chronicle } from "../../chronicles";
import type { ArmorSet, Item, SkillEffect } from "../../types";
import {
  getArmorSetsByItemId,
  getItemById,
  getSaVariants,
  getSaBaseWeaponId,
  getRecipeByItemId,
  getRecipesByProductId,
  getSkillByKey,
} from "../../data/indexes";
import type { ArmorSetListDto } from "./armor-set";

export interface SkillSummaryDto {
  id: number;
  level: number;
  name: string;
  operateType: string | null;
  target: string | null;
  iconFile: string | null;
  description: string | null;
  /**
   * Raw `power` value from the skill XML. Semantics depend on `skillType`.
   * Exposed so consumers can format their own text; the DTO already uses
   * it internally to derive a `fallbackDescription` for SA variants whose
   * skills carry `"none"` as their canned description.
   */
  power: number | null;
  /**
   * Raw `skillType` (DRAIN / MDAM / …). Exposed for the same reason as
   * `power` — lets consumers decide formatting.
   */
  skillType: string | null;
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
  partOfSets?: ArmorSetListDto[];
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
 * Generic, source-derived description for a skill whose canonical
 * description is `"none"` in `skillname-e.dat`. Uses the skill's
 * `skillType` + `power` fields as provably-true inputs — no editorial
 * text, no invented mechanics. Returns `null` when the skill's
 * structured data doesn't support a faithful sentence; callers should
 * leave such cases unresolved.
 *
 * Currently covers DRAIN skills (Critical Drain family: 10 skill ids,
 * 13 SA variants across A/B/C grades). Other skill types (MDAM, BUFF,
 * DamOverTime, etc.) are deliberately not covered here because either
 * the `power` semantics are ambiguous (MDAM's 8.39 isn't a clean
 * player-facing magnitude) or the magnitude lives in `<effect>` blocks
 * the parser doesn't traverse.
 */
function deriveSkillDescription(
  skillType: string | null,
  power: number | null
): string | null {
  if (skillType === "DRAIN" && power != null) {
    const rounded =
      Math.abs(power) >= 1 ? Math.round(power) : Number(power.toFixed(1));
    return `During a critical attack, absorbs ${rounded} HP from target.`;
  }
  return null;
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

const PVP_STUB_SENTENCE = "Increases damage inflicted during PvP.";
// Strips a trailing clause about PvP damage, whether it's a separate sentence
// ("…HP. Inflicts additional damage during PvP.") or conjunctive
// ("…rate and damage inflicted during PvP." / "…Speed and enhances damage
// to target during PvP."). The clause must open with a specific verb (or
// literal "damage") so we don't swallow preceding unrelated conjunctions
// like "…Accuracy, and enables the character to attack multiple opponents and
// inflicts additional damage during PvP." — only the rightmost " and inflicts
// …" clause is stripped there, keeping the multi-target phrase intact.
const PVP_TRAILING_CLAUSE =
  /\s*(?:\.\s+|,\s+|\s+and\s+)(?:Inflicts|Increases|Enhances|inflicts|increases|enhances|damage)[^.,]*\s+during PvP\.\s*$/;

function normalizeDescription(raw: string | null): string | null {
  if (!raw || raw === "none") return null;
  if (raw === PVP_STUB_SENTENCE) return null;
  const stripped = raw.replace(PVP_TRAILING_CLAUSE, "").trimEnd();
  if (stripped.length === 0) return null;
  return /[.!?]$/.test(stripped) ? stripped : stripped + ".";
}

/**
 * Round a raw `<for>`-block effect value into a clean, consumer-friendly
 * number. Only applies to `add` entries (mul is rendered as a percent
 * delta elsewhere). Values ≥ 1 round to integers (32.05 → 32); values
 * below 1 keep one decimal so tiny magnitudes like MP regen 0.54 don't
 * collapse to 1. Done here so every API consumer — not just the UI —
 * gets normalized numbers in `SkillSummaryDto.effects`.
 */
function roundEffectValue(
  op: "mul" | "add",
  value: number
): number {
  if (op === "mul") return value;
  if (Math.abs(value) >= 1) return Math.round(value);
  return Number(value.toFixed(1));
}

export function resolveSkill(
  chronicle: Chronicle,
  itemSkill: string | null
): SkillSummaryDto | undefined {
  if (!itemSkill) return undefined;
  const skill = getSkillByKey(chronicle, itemSkill);
  if (!skill) return undefined;
  const description =
    normalizeDescription(skill.description) ??
    deriveSkillDescription(skill.skillType, skill.power);
  const roundedEffects = skill.effects?.map((e) => ({
    ...e,
    value: roundEffectValue(e.op, e.value),
  }));
  return {
    id: skill.id,
    level: skill.level,
    name: skill.name,
    operateType: skill.operateType,
    target: skill.target,
    iconFile: skill.iconFile,
    description,
    power: skill.power,
    skillType: skill.skillType,
    ...(roundedEffects && roundedEffects.length > 0
      ? { effects: roundedEffects }
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

  // Reverse cross-link: every armor set that lists this item as a piece.
  // Same compact shape as `ArmorSetListDto` from the armor-sets list
  // endpoint, so consumers can navigate `/api/.../armor-sets/{id}` for
  // the full detail. Plural — Tallum Helmet (547) belongs to 3 sets.
  const partOfSets = getArmorSetsByItemId(chronicle, item.id);
  if (partOfSets.length > 0) {
    dto.partOfSets = partOfSets.map(toArmorSetListDtoInline);
  }

  return dto;
}

/**
 * Inline copy of `toArmorSetListDto` to avoid an import cycle between
 * `item.ts` and `armor-set.ts` (the latter imports `resolveSkill` from
 * here). The shape is dead simple (id / name / pieceCount) — drift risk
 * is negligible. If the shape ever grows, factor it into a shared util.
 */
function toArmorSetListDtoInline(set: ArmorSet): ArmorSetListDto {
  let pieceCount = 1; // chest is always present
  if (set.pieces.legs != null) pieceCount++;
  if (set.pieces.head != null) pieceCount++;
  if (set.pieces.gloves != null) pieceCount++;
  if (set.pieces.feet != null) pieceCount++;
  return {
    id: set.id,
    name: set.name,
    pieceCount,
  };
}

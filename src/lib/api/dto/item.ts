import type { Chronicle } from "../../chronicles";
import type { Item } from "../../types";
import {
  getItemById,
  getSaVariants,
  getSaBaseWeaponId,
} from "../../data/indexes";

export interface SaVariantDto {
  itemId: number;
  name: string;
  saName: string;
  itemSkill: string;
  iconFile: string | null;
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
  specialAbilityOptions?: SaVariantDto[];
  baseWeaponId?: number;
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

  const variantIds = getSaVariants(chronicle, item.id);
  if (variantIds) {
    dto.specialAbilityOptions = variantIds
      .map((vid) => {
        const v = getItemById(chronicle, vid);
        if (!v || !v.itemSkill) return null;
        const dashIdx = v.name.indexOf(" - ");
        return {
          itemId: v.id,
          name: v.name,
          saName: dashIdx >= 0 ? v.name.slice(dashIdx + 3) : v.name,
          itemSkill: v.itemSkill,
          iconFile: v.iconFile,
        };
      })
      .filter((x): x is SaVariantDto => x !== null);
  }

  const baseId = getSaBaseWeaponId(chronicle, item.id);
  if (baseId !== undefined) {
    dto.baseWeaponId = baseId;
  }

  return dto;
}

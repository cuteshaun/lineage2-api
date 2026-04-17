import type { Item } from "../../types";

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

export function toItemDetailDto(item: Item): ItemDetailDto {
  return {
    id: item.id,
    name: item.name,
    type: item.type,
    grade: item.grade,
    weight: item.weight,
    price: item.price,
    material: item.material,
    bodypart: item.bodypart,
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
}

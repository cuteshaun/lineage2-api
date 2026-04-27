import type { Chronicle } from "../../chronicles";
import type { ArmorSet } from "../../types";
import { getItemById } from "../../data/indexes";
import { resolveSkill, type SkillSummaryDto } from "./skill";

/**
 * A piece reference inside an armor set — item id plus enough display
 * fields that consumers don't need a second round-trip to render the
 * piece. Mirrors the shape of `CraftingIngredientDto.{itemId,name,iconFile}`.
 */
export interface ArmorSetPieceDto {
  itemId: number;
  name: string;
  iconFile: string | null;
}

/**
 * Detail shape embedded into `ItemDetailDto.partOfSets[]`. Skill
 * references from the underlying `ArmorSet` model are fully resolved
 * into `SkillSummaryDto` so consumers see description + effects without
 * a second lookup. A skill that fails to resolve becomes `null` rather
 * than missing, so the field's presence still signals "this set has a
 * shield/enchant6 bonus" even when the skill data is incomplete.
 */
export interface ArmorSetDetailDto {
  id: number;
  name: string;
  pieces: {
    chest: ArmorSetPieceDto;
    legs?: ArmorSetPieceDto;
    head?: ArmorSetPieceDto;
    gloves?: ArmorSetPieceDto;
    feet?: ArmorSetPieceDto;
  };
  bonusSkill: SkillSummaryDto | null;
  shield?: {
    piece: ArmorSetPieceDto;
    bonusSkill: SkillSummaryDto | null;
  };
  enchant6BonusSkill?: SkillSummaryDto | null;
}

function resolvePiece(
  chronicle: Chronicle,
  itemId: number
): ArmorSetPieceDto {
  const item = getItemById(chronicle, itemId);
  return {
    itemId,
    name: item?.name ?? `#${itemId}`,
    iconFile: item?.iconFile ?? null,
  };
}

export function toArmorSetDetailDto(
  set: ArmorSet,
  chronicle: Chronicle
): ArmorSetDetailDto {
  const dto: ArmorSetDetailDto = {
    id: set.id,
    name: set.name,
    pieces: {
      chest: resolvePiece(chronicle, set.pieces.chest),
    },
    bonusSkill: resolveSkill(chronicle, set.bonusSkill) ?? null,
  };

  if (set.pieces.legs != null) {
    dto.pieces.legs = resolvePiece(chronicle, set.pieces.legs);
  }
  if (set.pieces.head != null) {
    dto.pieces.head = resolvePiece(chronicle, set.pieces.head);
  }
  if (set.pieces.gloves != null) {
    dto.pieces.gloves = resolvePiece(chronicle, set.pieces.gloves);
  }
  if (set.pieces.feet != null) {
    dto.pieces.feet = resolvePiece(chronicle, set.pieces.feet);
  }

  if (set.shield) {
    dto.shield = {
      piece: resolvePiece(chronicle, set.shield.itemId),
      bonusSkill: resolveSkill(chronicle, set.shield.bonusSkill) ?? null,
    };
  }

  if (set.enchant6BonusSkill) {
    dto.enchant6BonusSkill =
      resolveSkill(chronicle, set.enchant6BonusSkill) ?? null;
  }

  return dto;
}

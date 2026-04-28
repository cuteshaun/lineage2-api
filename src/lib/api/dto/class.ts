import type { Chronicle } from "../../chronicles";
import type { ClassRecord } from "../../types";
import {
  getChildClassIds,
  getClassById,
  getSkillByKey,
  getSpellbookItemBySkillId,
} from "../../data/indexes";

/**
 * Compact reference used in cross-links from items/skills back to the
 * class that learns them. Carries enough to render a clickable label
 * without a second round-trip.
 */
export interface ClassRefDto {
  id: number;
  name: string;
  professionLevel: number;
}

/**
 * One row in `ClassDetailDto.skills`. Includes the resolved skill name
 * + iconFile pulled from the existing `skills.json` (no new icon parser
 * — see roadmap M1). When the referenced skill id/level fails to
 * resolve, `name` falls back to `#<id>-<lvl>` and `iconFile` is `null`.
 */
export interface ClassSkillLearnDto {
  skillId: number;
  skillLevel: number;
  name: string;
  iconFile: string | null;
  /** Minimum player level required to learn this skill. */
  minPlayerLevel: number;
  /** Skill point cost. */
  spCost: number;
  /**
   * Item id of the spellbook required to learn this skill, when one
   * exists in `spellbooks.xml`. Most skills don't have a spellbook;
   * the field is omitted in that case.
   */
  spellbookItemId?: number;
}

export interface ClassListDto {
  id: number;
  name: string;
  race: string;
  type: string;
  professionLevel: number;
  parentClassId: number | null;
}

export interface ClassDetailDto extends ClassListDto {
  childClassIds: number[];
  skills: ClassSkillLearnDto[];
}

export function toClassListDto(c: ClassRecord): ClassListDto {
  return {
    id: c.id,
    name: c.name,
    race: c.race,
    type: c.type,
    professionLevel: c.professionLevel,
    parentClassId: c.parentClassId,
  };
}

export function toClassRefDto(c: ClassRecord): ClassRefDto {
  return {
    id: c.id,
    name: c.name,
    professionLevel: c.professionLevel,
  };
}

export function toClassDetailDto(
  c: ClassRecord,
  chronicle: Chronicle
): ClassDetailDto {
  const skills: ClassSkillLearnDto[] = c.skills.map((s) => {
    const resolved = getSkillByKey(chronicle, `${s.skillId}-${s.skillLevel}`);
    const dto: ClassSkillLearnDto = {
      skillId: s.skillId,
      skillLevel: s.skillLevel,
      name: resolved?.name ?? `#${s.skillId}-${s.skillLevel}`,
      iconFile: resolved?.iconFile ?? null,
      minPlayerLevel: s.minPlayerLevel,
      spCost: s.spCost,
    };
    const spellbookItemId = getSpellbookItemBySkillId(chronicle, s.skillId);
    if (spellbookItemId !== undefined) {
      dto.spellbookItemId = spellbookItemId;
    }
    return dto;
  });

  return {
    ...toClassListDto(c),
    childClassIds: getChildClassIds(chronicle, c.id),
    skills,
  };
}

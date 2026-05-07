import type { Chronicle } from "../../chronicles";
import type { ClassRecord } from "../../types";
import {
  getChildClassIds,
  getClassById,
  getHennasByClassId,
  getItemById,
  getSkillByKey,
  getSpellbookItemBySkillId,
} from "../../data/indexes";
import { toHennaSummaryDto, type HennaSummaryDto } from "./henna";

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
 * Compact reference to a spellbook item — surfaced under
 * `ClassSkillLearnDto.spellbook` so consumers can render `icon + name`
 * + a link without making N+1 item-detail calls.
 */
export interface SpellbookItemRefDto {
  itemId: number;
  name: string;
  iconFile: string | null;
}

/**
 * One row in `ClassDetailDto.skills`. Includes the resolved skill name,
 * description, and iconFile pulled from the existing `skills.json` (no
 * new icon parser — see roadmap M1). When the referenced skill id/level
 * fails to resolve, `name` falls back to `#<id>-<lvl>`, `description`
 * is `null`, and `iconFile` is `null`.
 */
export interface ClassSkillLearnDto {
  skillId: number;
  skillLevel: number;
  /**
   * Resolved skill name with `#${id}-${level}` fallback when the
   * source skill record is missing. Always present (best-effort).
   */
  name: string;
  /**
   * Resolved skill description from `skills.json` (sourced from the
   * L2 client `skillname-e.dat`). **Omitted** when the source carries
   * no description for this skill / level. Absence ≠ unknown — many
   * passive / engine-internal skills legitimately ship no
   * player-facing prose.
   */
  description?: string;
  /**
   * Resolved icon basename inside `public/icons/`, source-backed
   * from `skillgrp.dat`. **Omitted** when no source-resolved icon
   * is available — the public DTO does not inject default / fallback
   * icons, so consumers can render their own placeholder. Distinct
   * from NPC skill rendering, which uses fallback icons.
   */
  iconFile?: string;
  /** Minimum player level required to learn this skill. */
  minPlayerLevel: number;
  /** Skill point cost (one-time, paid every time the player learns a new level). */
  spCost: number;
  /**
   * MP consumed each time the player casts the skill at this level.
   * **Omitted** for passive / toggle skills with no MP cost in
   * source data (~42% of skill-learn rows on Interlude).
   */
  mpConsume?: number;
  /**
   * Spellbook item required to first learn this skill (once per skill,
   * not once per level — the source `spellbooks.xml` is keyed by
   * `skillId`, not `(skillId, skillLevel)`). Surfaced only on the
   * **lowest-skillLevel row per skill** within this class, since that's
   * the row where the player physically consumes the book. Subsequent
   * level-ups of the same skill don't carry the field. Omitted when no
   * spellbook is required.
   */
  spellbook?: SpellbookItemRefDto;
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
  /**
   * Henna symbols this class is permitted to engrave at a Symbol
   * Maker, fully resolved — display name, icon, stat changes,
   * price, and dye item ref. Sorted by `symbolId` ascending.
   * Omitted entirely when the chronicle ships no `hennas.xml` or
   * the class has no allowed hennas.
   */
  allowedHennas?: HennaSummaryDto[];
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
  // The spellbook is consumed once per skill family — the first time
  // the player learns it. For each skillId, find the lowest skillLevel
  // entry in this class's learn list; only that row carries the
  // `spellbook` field.
  const lowestLevelBySkillId = new Map<number, number>();
  for (const s of c.skills) {
    const cur = lowestLevelBySkillId.get(s.skillId);
    if (cur === undefined || s.skillLevel < cur) {
      lowestLevelBySkillId.set(s.skillId, s.skillLevel);
    }
  }

  const skills: ClassSkillLearnDto[] = c.skills.map((s) => {
    const resolved = getSkillByKey(chronicle, `${s.skillId}-${s.skillLevel}`);
    const dto: ClassSkillLearnDto = {
      skillId: s.skillId,
      skillLevel: s.skillLevel,
      name: resolved?.name ?? `#${s.skillId}-${s.skillLevel}`,
      minPlayerLevel: s.minPlayerLevel,
      spCost: s.spCost,
    };
    // description / iconFile / mpConsume use the omit-when-null
    // policy established by the M11/M12/M13 cleanups. Absence on
    // the wire means "not present in source", not "unknown". The
    // public DTO never injects fallback / default icons here —
    // consumers render their own placeholder when iconFile is
    // absent. (NPC skill rendering does use fallback icons; that's
    // a separate surface.)
    if (resolved?.description != null) dto.description = resolved.description;
    if (resolved?.iconFile != null) dto.iconFile = resolved.iconFile;
    if (resolved?.mpConsume != null) dto.mpConsume = resolved.mpConsume;

    const isLowestLevel = s.skillLevel === lowestLevelBySkillId.get(s.skillId);
    if (isLowestLevel) {
      const spellbookItemId = getSpellbookItemBySkillId(chronicle, s.skillId);
      if (spellbookItemId !== undefined) {
        const item = getItemById(chronicle, spellbookItemId);
        dto.spellbook = {
          itemId: spellbookItemId,
          name: item?.name ?? `#${spellbookItemId}`,
          iconFile: item?.iconFile ?? null,
        };
      }
    }
    return dto;
  });

  const allowedHennas = getHennasByClassId(chronicle, c.id);

  const dto: ClassDetailDto = {
    ...toClassListDto(c),
    childClassIds: getChildClassIds(chronicle, c.id),
    skills,
  };
  if (allowedHennas.length > 0) {
    dto.allowedHennas = allowedHennas.map((h) =>
      toHennaSummaryDto(h, chronicle)
    );
  }
  return dto;
}

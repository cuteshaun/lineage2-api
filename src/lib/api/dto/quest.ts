import type { Chronicle } from "../../chronicles";
import type { Quest } from "../../types";
import {
  getClassById,
  getItemById,
  getQuestNameById,
  getRawNpcById,
} from "../../data/indexes";
import { toClassRefDto, type ClassRefDto } from "./class";
import type { ItemQuantityDto, NpcRefDto } from "./item";

/**
 * Compact reference used in cross-links from items/NPCs back to a
 * quest. Carries enough to render a clickable label + a level hint
 * without a second round-trip. `roles?` is populated only on
 * `NpcDetailDto.involvedInQuests[]` entries (one or more of "talk"
 * / "kill") and omitted everywhere else.
 */
export interface QuestRefDto {
  id: number;
  name: string;
  levelMin: number | null;
  roles?: string[];
}

export interface QuestRewardsDto {
  items: ItemQuantityDto[];
  adena: number | null;
  exp: number | null;
  sp: number | null;
}

export interface QuestListDto {
  id: number;
  name: string;
  levelMin: number | null;
  repeatable: boolean | null;
  raceRestrictions: string[];
  classRestrictions: ClassRefDto[];
  startNpc: NpcRefDto | null;
  rewardsPreview: {
    adena: number | null;
    exp: number | null;
    sp: number | null;
    /** Length of `rewards.items[]` — full list lives on detail. */
    itemCount: number;
  };
}

export interface QuestDetailDto {
  id: number;
  name: string;
  scriptFile: string;
  levelMin: number | null;
  repeatable: boolean | null;
  raceRestrictions: string[];
  classRestrictions: ClassRefDto[];
  startNpcs: NpcRefDto[];
  involvedNpcs: NpcRefDto[];
  involvedMonsters: NpcRefDto[];
  /**
   * Items registered via `setItemsIds(...)`. Surfaced as
   * `count = 0` because the engine list doesn't carry quantities —
   * the field exists for shape parity with `ItemQuantityDto` and to
   * preserve the item icon/name resolution.
   */
  questItems: ItemQuantityDto[];
  rewards: QuestRewardsDto;
  /**
   * Player-facing flavor prose extracted from the L2 client's
   * `questname-e.dat` when the chronicle ships one. Authoritative
   * Java fields above (name, levelMin, repeatable, race/class
   * gates, rewards, NPC ids) are never overridden by the DAT —
   * `description` is purely additive. Omitted when the chronicle
   * doesn't ship the DAT or the quest has no DAT counterpart.
   */
  description?: string;
}

function resolveItemQuantityRefs(
  chronicle: Chronicle,
  pairs: Array<{ itemId: number; count: number }>
): ItemQuantityDto[] {
  return pairs
    .map((p) => {
      const it = getItemById(chronicle, p.itemId);
      return {
        itemId: p.itemId,
        name: it?.name ?? `#${p.itemId}`,
        iconFile: it?.iconFile ?? null,
        count: p.count,
      };
    })
    .sort((a, b) => a.itemId - b.itemId);
}

function resolveNpcRefs(
  chronicle: Chronicle,
  ids: number[]
): NpcRefDto[] {
  const out: NpcRefDto[] = [];
  for (const id of ids) {
    const npc = getRawNpcById(chronicle, id);
    if (!npc) continue;
    out.push({ id: npc.id, name: npc.name });
  }
  // Already deduped at parse time; sort for stable output.
  return out.sort((a, b) => a.id - b.id);
}

function resolveClassRefs(
  chronicle: Chronicle,
  ids: number[]
): ClassRefDto[] {
  const out: ClassRefDto[] = [];
  for (const id of ids) {
    const cls = getClassById(chronicle, id);
    if (!cls) continue;
    out.push(toClassRefDto(cls));
  }
  return out.sort((a, b) => a.id - b.id);
}

/**
 * Compact ref form. Used by item/NPC cross-links and by the
 * `involvedInQuests` reverse direction (where `roles?` populates).
 */
export function toQuestRefDto(q: Quest, roles?: string[]): QuestRefDto {
  const dto: QuestRefDto = {
    id: q.id,
    name: q.name,
    levelMin: q.levelMin,
  };
  if (roles && roles.length > 0) dto.roles = roles;
  return dto;
}

export function toQuestListDto(
  q: Quest,
  chronicle: Chronicle
): QuestListDto {
  const startNpcs = resolveNpcRefs(chronicle, q.startNpcIds);
  return {
    id: q.id,
    name: q.name,
    levelMin: q.levelMin,
    repeatable: q.repeatable,
    raceRestrictions: q.raceRestrictions,
    classRestrictions: resolveClassRefs(chronicle, q.classRestrictions),
    startNpc: startNpcs[0] ?? null,
    rewardsPreview: {
      adena: q.rewards.adena,
      exp: q.rewards.exp,
      sp: q.rewards.sp,
      itemCount: q.rewards.items.length,
    },
  };
}

export function toQuestDetailDto(
  q: Quest,
  chronicle: Chronicle
): QuestDetailDto {
  const dto: QuestDetailDto = {
    id: q.id,
    name: q.name,
    scriptFile: q.scriptFile,
    levelMin: q.levelMin,
    repeatable: q.repeatable,
    raceRestrictions: q.raceRestrictions,
    classRestrictions: resolveClassRefs(chronicle, q.classRestrictions),
    startNpcs: resolveNpcRefs(chronicle, q.startNpcIds),
    involvedNpcs: resolveNpcRefs(chronicle, q.talkNpcIds),
    involvedMonsters: resolveNpcRefs(chronicle, q.killNpcIds),
    questItems: resolveItemQuantityRefs(
      chronicle,
      q.questItemIds.map((itemId) => ({ itemId, count: 0 }))
    ),
    rewards: {
      items: resolveItemQuantityRefs(chronicle, q.rewards.items),
      adena: q.rewards.adena,
      exp: q.rewards.exp,
      sp: q.rewards.sp,
    },
  };
  const questName = getQuestNameById(chronicle, q.id);
  if (questName && questName.description.length > 0) {
    dto.description = questName.description;
  }
  return dto;
}

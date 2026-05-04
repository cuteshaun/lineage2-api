import type { Chronicle } from "../../chronicles";
import type { Quest } from "../../types";
import {
  getCleanedNpcByName,
  getClassById,
  getItemById,
  getNpcSpawns,
  getQuestNameById,
  getRawNpcById,
} from "../../data/indexes";
import { toClassRefDto, type ClassRefDto } from "./class";
import type { ItemQuantityDto, NpcRefDto } from "./item";
import type { RegionRefDto } from "./region";
import { computePrimaryRegion } from "./spawn";
import { computePrimaryLocation, type LocationRefDto } from "./location";

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

/**
 * One entry in the player's in-game quest log for this quest, sourced
 * from the L2 client's `questname-e.dat`. Mirrors what the client
 * actually displays — `title` is the short label that appears in the
 * journal (e.g. "Delivery of Love Letters"), `description` is the
 * prose text shown when this step is active, `completionNpc` resolves
 * the DAT-supplied completion-NPC name to a known cleaned NPC.
 *
 * **Honesty note**: these are client-authored journal entries, not a
 * mechanically-derived walkthrough. The order is the DAT's stepIndex
 * (1-based), and the entries are usually one-per-quest-state in
 * sequence — but the engine is free to advance/reset state via Java
 * code that doesn't always trace cleanly through these indices, so
 * consumers should treat the list as "what the client log shows" not
 * "the canonical walk path".
 */
export interface QuestClientJournalEntryDto {
  /** 1-based step index from the DAT record header. */
  stepIndex: number;
  /** Short journal label (e.g. "Delivery of Love Letters"). */
  title: string;
  /**
   * Prose journal text shown when this step is active. Carried
   * verbatim from the DAT — full text, no truncation. The original
   * client text can include literal `\n` characters for line breaks;
   * those are preserved as-is for client-side rendering decisions.
   */
  description: string;
  /**
   * Completion NPC for this step — the NPC the player is meant to
   * talk to next when this entry is the active log line. Resolved
   * by exact-name match against the cleaned NPC index. `null` when
   * the step record doesn't carry an NPC slot (multi-objective
   * steps occasionally omit it) OR the supplied name doesn't match
   * any known NPC in this chronicle.
   */
  completionNpc: NpcRefDto | null;
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
  /**
   * In-game quest journal entries from `questname-e.dat`, one per
   * step. Mirrors what the player actually sees in their client
   * quest log — short titles + prose text + completion NPC. NOT a
   * mechanically-derived walkthrough; consumers should render this
   * as "the journal" rather than "the walkthrough". Ordered by
   * `stepIndex` ascending. Omitted when the chronicle doesn't ship
   * the DAT, the quest has no DAT counterpart, or every step row's
   * title/description is empty.
   */
  clientJournalEntries?: QuestClientJournalEntryDto[];
  /**
   * Most-frequent map region across the **first** start NPC's
   * cleaned spawns (mode by region id, lowest-id tiebreak —
   * matches the existing `NpcDetailDto.primaryRegion?` rule).
   * Answers "where do I start this quest?" without a second
   * round-trip. Omitted when:
   *
   *   - the quest has no `startNpcs`, or
   *   - the first start NPC has no spawns (e.g. dynamically
   *     spawned by Java, or a server-side helper), or
   *   - every spawn falls outside the upstream `mapRegions.xml`
   *     tile grid, or
   *   - the chronicle ships no `mapRegions.xml`.
   *
   * **Multi-start-NPC caveat**: a handful of saga quests have
   * multiple start NPCs in different regions (e.g. profession
   * quests). The field reflects the first start NPC's region
   * only; this is documented behavior, not a bug. The full
   * region picture is reachable via the existing `startNpcs[]`
   * → NPC-detail → `primaryRegion?` path.
   */
  primaryRegion?: RegionRefDto;
  /**
   * **Player-facing primary location** of the quest (M7) — the
   * first start NPC's primary location, derived via mode-of-spawns
   * over its cleaned spawns. Sourced from `huntingzone-e.dat`
   * (e.g. *"Cruma Tower"*, *"Talking Island Village"*).
   * Complementary to `primaryRegion`, not a replacement: region is
   * the coarse death-teleport anchor; location is the fine
   * player-facing area name.
   *
   * Resolution is **nearest-anchor with a fixed 10000-unit 2D
   * threshold**, not polygon containment. Multi-start-NPC quests
   * (rare) reflect the first start NPC's location only — same
   * convention as `primaryRegion?`.
   *
   * Omitted when:
   *   - the quest has no `startNpcs`, or
   *   - the first start NPC has no spawns,
   *   - every spawn is too far from any anchor, or
   *   - the chronicle ships no `huntingzone-e.dat`.
   */
  primaryLocation?: LocationRefDto;
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
  if (questName && questName.steps.length > 0) {
    const journal = questName.steps
      .map((s): QuestClientJournalEntryDto => {
        const npc = s.completionNpcName
          ? getCleanedNpcByName(chronicle, s.completionNpcName)
          : null;
        return {
          stepIndex: s.stepIndex,
          title: s.title,
          description: s.description,
          completionNpc: npc ? { id: npc.id, name: npc.name } : null,
        };
      })
      // Steps come in stepIndex order from the parser, but be
      // defensive — runtime sort is cheap and locks the contract.
      .sort((a, b) => a.stepIndex - b.stepIndex);
    if (journal.length > 0) {
      dto.clientJournalEntries = journal;
    }
  }

  // primaryRegion: derive from the first start NPC's cleaned spawns,
  // matching the existing NpcDetailDto.primaryRegion? rule (mode by
  // region id, lowest-id tiebreak). The first start NPC is the
  // canonical "go here to start" anchor; multi-start-NPC quests
  // (rare saga cases) are documented to reflect the first one.
  if (q.startNpcIds.length > 0) {
    const firstStart = q.startNpcIds[0];
    const startSpawns = getNpcSpawns(chronicle, firstStart);
    const region = computePrimaryRegion(startSpawns, chronicle);
    if (region) dto.primaryRegion = region;
    const location = computePrimaryLocation(startSpawns, chronicle);
    if (location) dto.primaryLocation = location;
  }

  return dto;
}

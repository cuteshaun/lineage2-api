import type { Npc } from "../../types";
import type { Chronicle } from "../../chronicles";
import {
  getNpcSpawns,
  getQuestsByInvolvedNpcId,
  getQuestsByStartNpcId,
  getSkillByKey,
} from "../../data/indexes";
import { toQuestRefDto, type QuestRefDto } from "./quest";
import { computePrimaryRegion } from "./spawn";
import type { RegionRefDto } from "./region";
import { computePrimaryLocation } from "./location";
import type { LocationRefDto } from "./location";

export interface NpcListDto {
  id: number;
  name: string;
  title: string | null;
  level: number | null;
  npcType: string | null;
  hp: number | null;
  isAggressive: boolean;
}

/**
 * Vitals + reward + combat + movement stats. Always present on
 * `NpcDetailDto` — every NPC in source ships these 12 values
 * (verified across all 6,472 Interlude NPCs; zero have a null in
 * any of them). Source-clean from `npc.xml` `<set name="…">`. No
 * engine simulation, no rebalancing.
 */
export interface NpcStatsDto {
  hp: number;
  mp: number;
  exp: number;
  sp: number;
  pAtk: number;
  pDef: number;
  mAtk: number;
  mDef: number;
  crit: number;
  atkSpd: number;
  walkSpd: number;
  runSpd: number;
}

/**
 * Six base attributes from `<set name="str|dex|con|int|wit|men">`.
 * Always present. Most NPCs ship the engine default boss block
 * `60/73/57/76/70/80`; ordinary monsters carry per-tier values.
 */
export interface NpcBaseStatsDto {
  str: number;
  dex: number;
  con: number;
  int: number;
  wit: number;
  men: number;
}

/**
 * Combat AI ranges. Group is omitted entirely on the 7 NPCs that
 * have no `<ai>` block at all. When present, `aggroRange` is
 * always set (including the meaningful `0` = passive); `assistRange`
 * is omitted on the ~67% of NPCs without a clan / `clanRange`.
 */
export interface NpcBehaviorDto {
  /**
   * Sight-aggro radius in game units, from `<ai aggro="…">`. `0` is
   * meaningful — the NPC is passive (won't initiate combat on sight).
   * Always present when this group is present.
   */
  aggroRange: number;
  /**
   * Clan-assist radius in game units, from `<ai clanRange="…">`.
   * Members of the same engine clan within this distance come help
   * when this NPC is attacked. **Distinct from `aggroRange`** —
   * sight-aggro is *"I see a player and attack"*; clan-assist is
   * *"a clan member was attacked, I help"*. The internal clan slug
   * (e.g. `"queen_ant_clan"`) is **not** exposed.
   */
  assistRange?: number;
}

export interface NpcDetailDto {
  // ── Always present ──
  id: number;
  name: string;
  level: number | null;
  npcType: string | null;
  /**
   * Convenience boolean derived from `behavior?.aggroRange`. Mirrors
   * `NpcListDto.isAggressive` for parity across list and detail.
   * `true` when the NPC has an `<ai aggro="N">` with `N > 0`.
   */
  isAggressive: boolean;
  // ── Optional identity ── (omitted when source value is null)
  title?: string;
  race?: string;
  raceIconFile?: string;
  raceDescription?: string;
  // ── Always-present stat groups ──
  stats: NpcStatsDto;
  baseStats: NpcBaseStatsDto;
  // ── Optional behavior group ── (omitted when no <ai> block in source)
  behavior?: NpcBehaviorDto;
  // ── Always-emitted skills array ──
  skills: NpcSkillDto[];
  /**
   * Quests that this NPC starts (NPC ∈ `Quest.startNpcIds`). Compact
   * refs only — full quest detail lives at `/quests/[id]`. Empty when
   * the NPC starts no quests.
   */
  startsQuests?: QuestRefDto[];
  /**
   * Quests this NPC participates in beyond starting them — talk
   * targets and kill targets. A quest already in `startsQuests` is
   * re-listed here only when the NPC has a meaningful additional
   * role (kill target, or talk-target without being the starter).
   * `roles?` lists the contributing roles (e.g. `["talk"]`,
   * `["kill"]`, `["talk", "kill"]`).
   */
  involvedInQuests?: QuestRefDto[];
  /**
   * Most-frequent map region across this NPC's cleaned spawns
   * (mode by region id, lowest-id tiebreak). Omitted when:
   *
   *   - the NPC has no spawns, or
   *   - every spawn falls outside the upstream `mapRegions.xml`
   *     tile grid, or
   *   - the chronicle ships no `mapRegions.xml`.
   *
   * Note that aCis's `mapRegions.xml` encodes engine
   * "death-teleport" regions (which town the client teleports a
   * player to on death within that tile), not strict biome
   * polygons — so `primaryRegion` reads as "the in-game town this
   * NPC is associated with" rather than "this NPC's biome label".
   * See `RegionRefDto` for details.
   */
  primaryRegion?: RegionRefDto;
  /**
   * **Player-facing primary location** (M7) — the most-frequent
   * nearest-anchor zone across this NPC's cleaned spawns, sourced
   * from `huntingzone-e.dat` (e.g. *"Cruma Tower"*, *"Ant Nest"*,
   * *"Sea of Spores"*). Mode-of-spawns rule, lowest-id tiebreak —
   * same algorithm as `primaryRegion`. **Complementary to**
   * `primaryRegion`, not a replacement: region is the coarse
   * death-teleport anchor; location is the fine player-facing area.
   *
   * Resolution is **nearest-anchor with a fixed 10000-unit 2D
   * threshold**, not polygon containment — `huntingzone-e.dat`
   * carries only center anchors, no polygons. Coordinates outside
   * the threshold from every anchor produce `null` here, and the
   * field is **omitted** in that case.
   *
   * Omitted when:
   *   - the NPC has no spawns,
   *   - every spawn is too far from any anchor, or
   *   - the chronicle ships no `huntingzone-e.dat`.
   */
  primaryLocation?: LocationRefDto;
}

export interface NpcSkillDto {
  id: number;
  level: number;
  name: string | null;
  iconFile: string | null;
  description: string | null;
}

const RACE_BY_LEVEL: Record<number, string> = {
  1: "Undead",
  2: "Magic Creature",
  3: "Beast",
  4: "Animal",
  5: "Plant",
  6: "Humanoid",
  7: "Spirit",
  8: "Angel",
  9: "Demon",
  10: "Dragon",
  11: "Giant",
  12: "Bug",
  13: "Fairy",
  14: "Human",
  15: "Elf",
  16: "Dark Elf",
  17: "Orc",
  18: "Dwarf",
  19: "Other",
  20: "Non-race",
  21: "Siege",
  22: "Castle Guard",
  23: "Mercenary",
  24: "Unknown",
};

const RACE_ICON_BY_LEVEL: Record<number, string> = {
  1: "skill4290.png",              // Undead
  2: "skill4291.png",              // Magic Creature
  3: "skill4292.png",              // Beast
  4: "skill4293.png",              // Animal
  5: "skill4294.png",              // Plant
  6: "skill4295.png",              // Humanoid
  7: "skill4296.png",              // Spirit
  8: "skill4297.png",              // Angel
  9: "skill4298.png",              // Demon
  10: "skill4299.png",             // Dragon
  11: "skill4300.png",             // Giant
  12: "skill4301.png",             // Bug
  13: "skill4302.png",             // Fairy
  14: "skill4416_human.png",       // Human
  15: "skill4416_elf.png",         // Elf
  16: "skill4416_darkelf.png",     // Dark Elf
  17: "skill4416_orc.png",         // Orc
  18: "skill4416_dwarf.png",       // Dwarf
  19: "skill4416_etc.png",         // Other
  20: "skill4416_none.png",        // Non-race
  21: "skill4416_siegeweapon.png",  // Siege
  22: "skill4416_castleguard.png", // Castle Guard
  23: "skill4416_mercenary.png",   // Mercenary
};
const RACE_ICON_FALLBACK = "skill4416_etc.png";

const SKILL_ID_RACES = 4416;
const SKILL_ICON_FALLBACK = "skill0000.png";
const SKILL_ICON_BOSS = "skillboss.png";
const BOSS_NPC_TYPES = new Set(["GrandBoss", "RaidBoss"]);
const SUPPRESSED_SKILL_IDS = new Set([
  4408, // HP Modifiers
  4410, // P. Atk. Modifiers
  4411, // M. Atk. Modifiers
  4412, // P. Def. Modifiers
  4413, // M. Def. Modifiers
  4414, // Armor Type
  4416, // Races (consumed into `race`)
]);

export function toNpcListDto(npc: Npc): NpcListDto {
  return {
    id: npc.id,
    name: npc.name,
    title: npc.title,
    level: npc.level,
    npcType: npc.npcType,
    hp: npc.hp != null ? Math.round(npc.hp) : null,
    isAggressive: (npc.aiAggro ?? 0) > 0,
  };
}

export function toNpcDetailDto(npc: Npc, chronicle: Chronicle): NpcDetailDto {
  const raceSkill = npc.skills.find((s) => s.id === SKILL_ID_RACES);
  const race = raceSkill ? (RACE_BY_LEVEL[raceSkill.level] ?? null) : null;
  const raceIconFile = raceSkill
    ? (RACE_ICON_BY_LEVEL[raceSkill.level] ?? RACE_ICON_FALLBACK)
    : null;
  const raceDescription = raceSkill
    ? (getSkillByKey(chronicle, `${SKILL_ID_RACES}-${raceSkill.level}`)?.description ?? null)
    : null;

  // Quest cross-links. `startsQuests` is the unfiltered list of quests
  // started by the NPC. `involvedInQuests` lists quests where the NPC
  // has a kill role, or a talk role *without* also being the start NPC
  // (because a start NPC almost always doubles as a talk target during
  // the quest, and listing that overlap is noise).
  const startQuests = getQuestsByStartNpcId(chronicle, npc.id);
  const startedQuestIds = new Set(startQuests.map((q) => q.id));
  const involvedRaw = getQuestsByInvolvedNpcId(chronicle, npc.id);
  const involvedRefs: QuestRefDto[] = [];
  for (const q of involvedRaw) {
    const isTalk = q.talkNpcIds.includes(npc.id);
    const isKill = q.killNpcIds.includes(npc.id);
    const isStart = startedQuestIds.has(q.id);
    const roles: string[] = [];
    if (isTalk && !isStart) roles.push("talk");
    if (isKill) roles.push("kill");
    if (roles.length === 0) continue;
    involvedRefs.push(toQuestRefDto(q, roles));
  }

  // Stats / baseStats are required groups — every NPC in source ships
  // every key (verified across 6,472 Interlude NPCs). The defensive
  // `| null` types in the old DTO never realized in practice, so the
  // groups type as `number` (no nulls) and we fall back to `0` only as
  // a last-resort safety net for hypothetical future drift.
  const stats: NpcStatsDto = {
    hp: npc.hp != null ? Math.round(npc.hp) : 0,
    mp: npc.mp != null ? Math.round(npc.mp) : 0,
    exp: npc.exp ?? 0,
    sp: npc.sp ?? 0,
    pAtk: npc.pAtk != null ? Math.round(npc.pAtk) : 0,
    pDef: npc.pDef != null ? Math.round(npc.pDef) : 0,
    mAtk: npc.mAtk != null ? Math.round(npc.mAtk) : 0,
    mDef: npc.mDef != null ? Math.round(npc.mDef) : 0,
    crit: npc.crit ?? 0,
    atkSpd: npc.atkSpd ?? 0,
    walkSpd: npc.walkSpd ?? 0,
    runSpd: npc.runSpd ?? 0,
  };
  const baseStats: NpcBaseStatsDto = {
    str: npc.str ?? 0,
    dex: npc.dex ?? 0,
    con: npc.con ?? 0,
    int: npc.int ?? 0,
    wit: npc.wit ?? 0,
    men: npc.men ?? 0,
  };

  const dto: NpcDetailDto = {
    id: npc.id,
    name: npc.name,
    level: npc.level,
    npcType: npc.npcType,
    isAggressive: (npc.aiAggro ?? 0) > 0,
    stats,
    baseStats,
    skills: npc.skills
      .filter((s) => !SUPPRESSED_SKILL_IDS.has(s.id))
      .map((s) => {
        const resolved = getSkillByKey(chronicle, `${s.id}-${s.level}`);
        const isBossSelfSkill = BOSS_NPC_TYPES.has(npc.npcType ?? "") &&
          (resolved?.name ?? null) === npc.name;
        const iconFile = resolved?.iconFile
          ?? (isBossSelfSkill ? SKILL_ICON_BOSS : SKILL_ICON_FALLBACK);
        return {
          id: s.id,
          level: s.level,
          name: resolved?.name ?? null,
          iconFile,
          description: resolved?.description ?? null,
        };
      }),
  };

  // Optional identity fields — omit when source value is null, rather
  // than emitting `null`. Reduces noise on the ~65% of NPCs without a
  // title / race-skill assignment.
  if (npc.title != null) dto.title = npc.title;
  if (race != null) dto.race = race;
  if (raceIconFile != null) dto.raceIconFile = raceIconFile;
  if (raceDescription != null) dto.raceDescription = raceDescription;

  // Optional behavior group — omit entirely on the 7 NPCs without an
  // <ai> block in source. When present, `aggroRange` is always set
  // (including the meaningful `0` = passive); `assistRange` is omitted
  // on the ~67% of NPCs without a clan / clanRange.
  if (npc.aiAggro != null) {
    const behavior: NpcBehaviorDto = { aggroRange: npc.aiAggro };
    if (npc.aiClanRange != null) behavior.assistRange = npc.aiClanRange;
    dto.behavior = behavior;
  }

  if (startQuests.length > 0) {
    dto.startsQuests = startQuests
      .map((q) => toQuestRefDto(q))
      .sort((a, b) => a.id - b.id);
  }
  if (involvedRefs.length > 0) {
    dto.involvedInQuests = involvedRefs.sort((a, b) => a.id - b.id);
  }

  // primaryRegion is computed from the *cleaned* spawn aggregation,
  // matching the cleaned-NPC layer that this DTO represents. The
  // helper returns null when there are no spawns or every spawn falls
  // outside the mapped grid; we omit the field in that case.
  const spawns = getNpcSpawns(chronicle, npc.id);
  const primaryRegion = computePrimaryRegion(spawns, chronicle);
  if (primaryRegion) {
    dto.primaryRegion = primaryRegion;
  }

  // primaryLocation (M7) — nearest-anchor over the same cleaned
  // spawns. Independent of primaryRegion: a spawn might resolve to
  // a region but no nearby location, or vice versa.
  const primaryLocation = computePrimaryLocation(spawns, chronicle);
  if (primaryLocation) {
    dto.primaryLocation = primaryLocation;
  }

  return dto;
}

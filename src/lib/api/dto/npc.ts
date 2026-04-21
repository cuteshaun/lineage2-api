import type { Npc } from "../../types";
import type { Chronicle } from "../../chronicles";
import { getSkillByKey } from "../../data/indexes";

export interface NpcListDto {
  id: number;
  name: string;
  title: string | null;
  level: number | null;
  npcType: string | null;
  hp: number | null;
  isAggressive: boolean;
}

export interface NpcDetailDto {
  id: number;
  name: string;
  title: string | null;
  level: number | null;
  npcType: string | null;
  isAggressive: boolean;
  race: string | null;
  raceIconFile: string | null;
  raceDescription: string | null;
  hp: number | null;
  mp: number | null;
  exp: number | null;
  sp: number | null;
  pAtk: number | null;
  pDef: number | null;
  mAtk: number | null;
  mDef: number | null;
  crit: number | null;
  atkSpd: number | null;
  walkSpd: number | null;
  runSpd: number | null;
  skills: NpcSkillDto[];
}

export interface NpcSkillDto {
  id: number;
  level: number;
  name: string | null;
  iconFile: string | null;
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

  return {
    id: npc.id,
    name: npc.name,
    title: npc.title,
    level: npc.level,
    npcType: npc.npcType,
    isAggressive: (npc.aiAggro ?? 0) > 0,
    race,
    raceIconFile,
    raceDescription,
    hp: npc.hp != null ? Math.round(npc.hp) : null,
    mp: npc.mp != null ? Math.round(npc.mp) : null,
    exp: npc.exp,
    sp: npc.sp,
    pAtk: npc.pAtk != null ? Math.round(npc.pAtk) : null,
    pDef: npc.pDef != null ? Math.round(npc.pDef) : null,
    mAtk: npc.mAtk != null ? Math.round(npc.mAtk) : null,
    mDef: npc.mDef != null ? Math.round(npc.mDef) : null,
    crit: npc.crit,
    atkSpd: npc.atkSpd,
    walkSpd: npc.walkSpd,
    runSpd: npc.runSpd,
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
        };
      }),
  };
}

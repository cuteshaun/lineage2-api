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
  return {
    id: npc.id,
    name: npc.name,
    title: npc.title,
    level: npc.level,
    npcType: npc.npcType,
    isAggressive: (npc.aiAggro ?? 0) > 0,
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
    skills: npc.skills.map((s) => {
      const resolved = getSkillByKey(chronicle, `${s.id}-${s.level}`);
      return {
        id: s.id,
        level: s.level,
        name: resolved?.name ?? null,
        iconFile: resolved?.iconFile ?? null,
      };
    }),
  };
}

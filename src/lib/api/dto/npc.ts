import type { Npc } from "../../types";

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
  skills: { id: number; level: number }[];
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

export function toNpcDetailDto(npc: Npc): NpcDetailDto {
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
    skills: npc.skills,
  };
}

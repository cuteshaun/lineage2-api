/**
 * Public canonical monster view.
 *
 * The data layer's `CanonicalMonster` is a wrapper around the raw
 * `representative` Npc plus the grouping metadata. For the public API we
 * flatten the template fields onto the top level — consumers get a single
 * monster-shaped object where every field is part of the shared template,
 * plus the `sameTemplateEntries` and `otherVariants` arrays.
 *
 * --- What's included, and why ---
 *
 * Included (all template-equivalent fields from the fingerprint):
 *   identity/template: name, title, npcType, level,
 *                      radius, height, rHand, lHand,
 *                      exp, sp, hp, mp, hpRegen, mpRegen,
 *                      pAtk, pDef, mAtk, mDef, crit, atkSpd,
 *                      str, int, dex, wit, con, men,
 *                      corpseTime, walkSpd, runSpd, dropHerbGroup,
 *                      aiType, aiAggro, aiCanMove, aiSeedable,
 *                      aiSsCount, aiSsRate, aiSpsCount, aiSpsRate,
 *                      skills
 *   canonical metadata: canonicalId, sameTemplateEntries, otherVariants
 *   shared provenance:  source.project, source.chronicle
 *
 * Deliberately excluded (raw-only — not shared across sameTemplateEntries):
 *   - raw `id` (use `canonicalId` for canonical identity;
 *     `sameTemplateEntries` for the full raw id list)
 *   - `source.file` (varies by XML id-range bucket even for same-template
 *     raws; showing one file would misleadingly imply a single source)
 *   - `properties` (overflow bag, NOT in the template fingerprint — may
 *     legitimately differ between raws of the same template)
 *   - `petData` (irrelevant for monster npcTypes)
 *
 * A consumer who needs raw-only fields should hit `/api/[chronicle]/raw/monsters/[id]`.
 */

import type { Npc, NpcSkill } from "../types";
import type { CanonicalMonster } from "../data/canonical-monsters";

export interface CanonicalMonsterView {
  canonicalId: number;

  name: string;
  title: string | null;
  npcType: string | null;
  level: number | null;

  radius: number | null;
  height: number | null;
  rHand: number | null;
  lHand: number | null;

  exp: number | null;
  sp: number | null;

  hp: number | null;
  mp: number | null;
  hpRegen: number | null;
  mpRegen: number | null;

  pAtk: number | null;
  pDef: number | null;
  mAtk: number | null;
  mDef: number | null;
  crit: number | null;
  atkSpd: number | null;

  str: number | null;
  int: number | null;
  dex: number | null;
  wit: number | null;
  con: number | null;
  men: number | null;

  corpseTime: number | null;
  walkSpd: number | null;
  runSpd: number | null;
  dropHerbGroup: number | null;

  aiType: string | null;
  aiAggro: number | null;
  aiCanMove: boolean | null;
  aiSeedable: boolean | null;
  aiSsCount: number | null;
  aiSsRate: number | null;
  aiSpsCount: number | null;
  aiSpsRate: number | null;

  skills: NpcSkill[];

  /** All raw ids (incl. canonicalId) that share this exact template. Sorted. */
  sameTemplateEntries: number[];
  /** Canonical ids of same-name different-template monsters. Sorted. */
  otherVariants: number[];

  source: {
    project: "acis";
    chronicle: "interlude";
  };
}

export function toCanonicalMonsterView(
  c: CanonicalMonster
): CanonicalMonsterView {
  const r: Npc = c.representative;
  return {
    canonicalId: c.canonicalId,

    name: r.name,
    title: r.title,
    npcType: r.npcType,
    level: r.level,

    radius: r.radius,
    height: r.height,
    rHand: r.rHand,
    lHand: r.lHand,

    exp: r.exp,
    sp: r.sp,

    hp: r.hp,
    mp: r.mp,
    hpRegen: r.hpRegen,
    mpRegen: r.mpRegen,

    pAtk: r.pAtk,
    pDef: r.pDef,
    mAtk: r.mAtk,
    mDef: r.mDef,
    crit: r.crit,
    atkSpd: r.atkSpd,

    str: r.str,
    int: r.int,
    dex: r.dex,
    wit: r.wit,
    con: r.con,
    men: r.men,

    corpseTime: r.corpseTime,
    walkSpd: r.walkSpd,
    runSpd: r.runSpd,
    dropHerbGroup: r.dropHerbGroup,

    aiType: r.aiType,
    aiAggro: r.aiAggro,
    aiCanMove: r.aiCanMove,
    aiSeedable: r.aiSeedable,
    aiSsCount: r.aiSsCount,
    aiSsRate: r.aiSsRate,
    aiSpsCount: r.aiSpsCount,
    aiSpsRate: r.aiSpsRate,

    skills: r.skills,

    sameTemplateEntries: c.sameTemplateEntries,
    otherVariants: c.otherVariants,

    source: {
      project: r.source.project,
      chronicle: r.source.chronicle,
    },
  };
}

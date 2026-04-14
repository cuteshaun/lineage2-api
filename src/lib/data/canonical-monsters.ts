/**
 * Canonical monster model — first iteration.
 *
 * Two layers exist for monster data:
 *
 *   1. RAW layer — every monster as it appears in the source dataset, with
 *      its source-faithful id and provenance preserved. The existing
 *      `getMonsters()` / `getMonsterById()` functions return raw monsters.
 *      Raw entries are never deleted or merged — each one is reachable.
 *
 *   2. CANONICAL layer — derived from raw. Raw monsters that share an
 *      identical "template" (same name + same template fingerprint) are
 *      grouped under one `CanonicalMonster`. The canonical id is the lowest
 *      raw id in the group. Each canonical monster carries:
 *        - `representative`: the raw `Npc` chosen for the canonical view
 *        - `sameTemplateEntries`: all raw ids in the group (incl. the
 *          representative)
 *        - `otherVariants`: canonical ids of monsters with the same exact
 *          name but a different template
 *
 * This module is deliberately UI/API-free. It exposes pure functions; the
 * cached chronicle index in `indexes.ts` calls `buildCanonicalMonsters` once
 * per chronicle and stores the result.
 *
 * Future extensions live next to `representative` on `CanonicalMonster` —
 * `spawns`, `icon`, `localizedName`, etc. — without polluting the raw `Npc`
 * shape and without recomputing groupings.
 *
 * --- Template equivalence: which fields participate ---
 *
 * Two raw monsters are considered the same template iff every field below is
 * deeply equal. EVERYTHING else on the `Npc` (id, source, properties,
 * petData) is treated as raw-only and NOT part of the template.
 *
 *   identity-ish:    name, title, npcType, level
 *   geometry:        radius, height, rHand, lHand
 *   xp/sp:           exp, sp
 *   vitals:          hp, mp, hpRegen, mpRegen
 *   combat:          pAtk, pDef, mAtk, mDef, crit, atkSpd
 *   base stats:      str, int, dex, wit, con, men
 *   timing/movement: corpseTime, walkSpd, runSpd, dropHerbGroup
 *   AI:              aiType, aiAggro, aiCanMove, aiSeedable,
 *                    aiSsCount, aiSsRate, aiSpsCount, aiSpsRate
 *   skills:          full set, order-independent (sorted by id then level)
 *   drops + spoil:   full categorized table, order-independent (sorted)
 *
 * Equality is exact (no float tolerance). A 0.04 HP difference produces two
 * different templates. This matches the user's spec ("same stats") and is
 * easier to relax later than to tighten.
 */

import type { Npc, NpcDrops } from "../types";

export interface CanonicalMonster {
  /** Stable canonical id; equal to the lowest raw id in the group. */
  canonicalId: number;
  /** The raw `Npc` whose id matches `canonicalId`. Always present. */
  representative: Npc;
  /**
   * All raw monster ids (including `canonicalId`) that share the same
   * template. Always sorted ascending. Length >= 1.
   */
  sameTemplateEntries: number[];
  /**
   * Canonical ids of OTHER monsters that share the same exact `name`
   * but resolve to a different template fingerprint. Sorted ascending.
   * Empty when this name appears in only one template.
   */
  otherVariants: number[];
}

export interface BuildCanonicalMonstersResult {
  canonicalMonsters: CanonicalMonster[];
  /** Lookup by canonicalId. */
  canonicalMonstersById: Map<number, CanonicalMonster>;
  /** Map every raw monster id to its canonical id. Includes the canonical id mapped to itself. */
  rawIdToCanonicalId: Map<number, number>;
}

/**
 * Deterministically serialize the template fields of a monster (plus its
 * drops) into a single string suitable for grouping. Two raw monsters that
 * produce the same fingerprint AND have the same name are members of the
 * same template.
 *
 * The fingerprint deliberately does NOT include `name` — name is the
 * grouping partition key, used separately. Excluding it from the fingerprint
 * lets us cleanly compute `otherVariants` (same name, different fingerprint)
 * without redundant string comparisons.
 */
export function monsterTemplateFingerprint(
  npc: Npc,
  drops: NpcDrops | undefined
): string {
  const skillsFp = [...npc.skills]
    .sort((a, b) => a.id - b.id || a.level - b.level)
    .map((s) => `${s.id}:${s.level}`)
    .join(",");

  const dropsFp = drops ? serializeDrops(drops) : "";

  // List fields in a fixed order so the JSON serialization is stable.
  // Everything in this object is template-relevant. See file header for the
  // full definition of which fields participate in template equivalence.
  return JSON.stringify({
    title: npc.title,
    npcType: npc.npcType,
    level: npc.level,
    radius: npc.radius,
    height: npc.height,
    rHand: npc.rHand,
    lHand: npc.lHand,
    exp: npc.exp,
    sp: npc.sp,
    hp: npc.hp,
    mp: npc.mp,
    hpRegen: npc.hpRegen,
    mpRegen: npc.mpRegen,
    pAtk: npc.pAtk,
    pDef: npc.pDef,
    mAtk: npc.mAtk,
    mDef: npc.mDef,
    crit: npc.crit,
    atkSpd: npc.atkSpd,
    str: npc.str,
    int: npc.int,
    dex: npc.dex,
    wit: npc.wit,
    con: npc.con,
    men: npc.men,
    corpseTime: npc.corpseTime,
    walkSpd: npc.walkSpd,
    runSpd: npc.runSpd,
    dropHerbGroup: npc.dropHerbGroup,
    aiType: npc.aiType,
    aiAggro: npc.aiAggro,
    aiCanMove: npc.aiCanMove,
    aiSeedable: npc.aiSeedable,
    aiSsCount: npc.aiSsCount,
    aiSsRate: npc.aiSsRate,
    aiSpsCount: npc.aiSpsCount,
    aiSpsRate: npc.aiSpsRate,
    skills: skillsFp,
    drops: dropsFp,
  });
}

function serializeDrops(d: NpcDrops): string {
  // Sort categories by id (with nulls last), and entries within each by
  // itemId. This makes the result order-independent w.r.t. the source XML.
  return [...d.categories]
    .sort((a, b) => {
      if (a.categoryId === null) return 1;
      if (b.categoryId === null) return -1;
      return a.categoryId - b.categoryId;
    })
    .map((cat) => {
      const entries = [...cat.drops]
        .sort((a, b) => a.itemId - b.itemId)
        .map(
          (e) =>
            `${e.itemId}:${e.min ?? ""}:${e.max ?? ""}:${e.chance ?? ""}`
        )
        .join("|");
      return `${cat.categoryId ?? "null"}=[${entries}]`;
    })
    .join(";");
}

/**
 * Group raw monsters into canonical monsters. Pure function — no I/O, no
 * chronicle awareness. `monsters` should be the already-filtered raw monster
 * list; `dropsByNpcId` should be a lookup of NPC drops keyed by raw id.
 */
export function buildCanonicalMonsters(
  monsters: Npc[],
  dropsByNpcId: Map<number, NpcDrops>
): BuildCanonicalMonstersResult {
  // Step 1: bucket raw monsters by `(name, fingerprint)`. Same key = same
  // template = sameTemplateEntries.
  const buckets = new Map<string, Npc[]>();
  for (const m of monsters) {
    const fp = monsterTemplateFingerprint(m, dropsByNpcId.get(m.id));
    const key = `${m.name}\u0000${fp}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(m);
  }

  // Step 2: build a CanonicalMonster per bucket. The representative is the
  // raw entry with the lowest id; sameTemplateEntries is the sorted id list.
  const canonicalById = new Map<number, CanonicalMonster>();
  // name → list of canonical ids that exist under this name (used for variants)
  const canonicalIdsByName = new Map<string, number[]>();

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.id - b.id);
    const representative = bucket[0];
    const canonicalId = representative.id;
    const canonical: CanonicalMonster = {
      canonicalId,
      representative,
      sameTemplateEntries: bucket.map((m) => m.id),
      otherVariants: [], // filled in step 3
    };
    canonicalById.set(canonicalId, canonical);

    let nameList = canonicalIdsByName.get(representative.name);
    if (!nameList) {
      nameList = [];
      canonicalIdsByName.set(representative.name, nameList);
    }
    nameList.push(canonicalId);
  }

  // Step 3: for each canonical monster, otherVariants = the OTHER canonical
  // ids sharing the same name. Sorted ascending. Empty when only one
  // canonical exists for that name.
  for (const [, ids] of canonicalIdsByName) {
    if (ids.length < 2) continue;
    ids.sort((a, b) => a - b);
    for (const canonicalId of ids) {
      const canonical = canonicalById.get(canonicalId)!;
      canonical.otherVariants = ids.filter((id) => id !== canonicalId);
    }
  }

  // Step 4: build the raw → canonical reverse lookup.
  const rawIdToCanonicalId = new Map<number, number>();
  for (const canonical of canonicalById.values()) {
    for (const rawId of canonical.sameTemplateEntries) {
      rawIdToCanonicalId.set(rawId, canonical.canonicalId);
    }
  }

  // Final array: sorted by canonicalId for stable iteration.
  const canonicalMonsters = [...canonicalById.values()].sort(
    (a, b) => a.canonicalId - b.canonicalId
  );

  return {
    canonicalMonsters,
    canonicalMonstersById: canonicalById,
    rawIdToCanonicalId,
  };
}

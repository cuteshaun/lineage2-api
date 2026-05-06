import { expect, test } from "vitest";
import { toItemDetailDto } from "@/lib/api/dto/item";
import { getItemById } from "@/lib/data/indexes";

/**
 * Representative weapons covering every SA enrichment path. A change to the
 * `ItemDetailDto` shape, the `SaVariantDto` shape, the rounding rules, the
 * shared-bonus computation, the `pvpBonus` rule, the apostrophe-normalized
 * grouping, the A-grade name dedup, the Critical Drain power derivation, or
 * any of the related DTO logic will surface here as a snapshot diff.
 *
 * If a diff is intentional, regenerate with `pnpm test -- -u`.
 *
 * Picked to be 12 weapons that *together* exercise:
 * - S-grade canonical (Angel Slayer)
 * - Polearm `+4 Attack Count` shared bonus (Saint Spear, Tallum Glaive)
 * - Apostrophe-normalized base (Heaven's Divider — variants drop the apostrophe)
 * - C-grade with no `pvpBonus` + unresolved skill 3498-1 Light (Stormbringer)
 * - Bow with all three SA flavors: skill, oncrit trigger, save-mechanic (Draconic Bow)
 * - A-grade dedup of 4xxx vs 5xxx variants + statDelta (Carnage Bow)
 * - Critical Drain `power` + DRAIN derivation (Elysian)
 * - B-grade save-mechanic (Bow of Peril)
 * - oncast trigger on a magic weapon (Branch of The Mother Tree)
 * - Beginner-gear with no SA mechanic (Falchion)
 * - Magical S-grade with regHp/regMp fractional rounding (Arcana Mace)
 * - Armor piece with N:M `partOfSets` cross-link (Tallum Helmet — id 547,
 *   member of three Tallum sets: Heavy / Light / Robe)
 * - Mammon `exchangeFrom` — A-grade unsealed armor (Tallum Plate Armor 2382)
 * - Mammon `exchangeFor` — A-grade sealed armor (Sealed Tallum Plate Armor 5293)
 * - Spellbook (`usedAsSpellbook`) — Spellbook: Heal (id 1152) — locks the
 *   skill→class learner cross-link for spellbook items.
 * - BuyList (`soldBy`) — Wooden Arrow (id 17) — basic ammunition sold by
 *   many grocers; locks the multi-NPC `soldBy[]` shape.
 * - Apella exchange (`exchangeFrom`) — Sealed Apella Plate Armor (7871) —
 *   exercises Clan Reputation + Adena multi-currency with castle-tax
 *   collapse (raw split summed into one Adena line in the public DTO).
 * - B-grade unseal multi-NPC — Zubei's Gauntlets - Heavy Armor (5710) —
 *   first production of multisell 1002; locks `npcs[]` plural with all
 *   14 town blacksmiths in one entry.
 */
const REPRESENTATIVE_ITEMS: Array<{ id: number; name: string }> = [
  { id: 6367, name: "Angel Slayer" },
  { id: 6370, name: "Saint Spear" },
  { id: 6372, name: "Heaven's Divider" },
  { id: 72, name: "Stormbringer" },
  { id: 7575, name: "Draconic Bow" },
  { id: 288, name: "Carnage Bow" },
  { id: 164, name: "Elysian" },
  { id: 287, name: "Bow of Peril" },
  { id: 213, name: "Branch of The Mother Tree" },
  { id: 68, name: "Falchion" },
  { id: 6579, name: "Arcana Mace" },
  { id: 305, name: "Tallum Glaive" },
  { id: 547, name: "Tallum Helmet" },
  { id: 2382, name: "Tallum Plate Armor" },
  { id: 5293, name: "Sealed Tallum Plate Armor" },
  { id: 1152, name: "Spellbook: Heal" },
  { id: 17, name: "Wooden Arrow" },
  { id: 7871, name: "Sealed Apella Plate Armor" },
  { id: 5710, name: "Zubei's Gauntlets - Heavy Armor" },
  // Quest cross-link fixtures:
  // - Necklace (906) — final reward of Q001+Q005, locks
  //   `rewardedByQuests` with `count: 1` per row.
  // - Darin's Letter (687) — registered via `setItemsIds` of Q001,
  //   locks `questItemFor` (transient items).
  // - Adena (57) — engine-special: `q.rewards.adena` scalar joins
  //   into `rewardedByQuests` with per-quest amounts (e.g. Q111
  //   Elrokian Hunter's Proof at 1,022,636a). Locks the Adena
  //   join path that no other fixture covers.
  { id: 906, name: "Necklace (Q001 reward)" },
  { id: 687, name: "Darin's Letter (Q001 quest item)" },
  { id: 57, name: "Adena (rewardedByQuests adena join)" },
  // Henna cross-link fixtures (M8):
  // - 4445: dye for symbolId=1 (Symbol of Strength) — full DAT display.
  // - 4624: dye for symbolId=180 (Greater II tier) — `henna.displayName` etc. null.
  { id: 4445, name: "Dye of STR (Str+1 Con-3) — symbolId 1" },
  { id: 4624, name: "Dye of MEN (Men-4 Wit+4) — symbolId 180" },
];

for (const { id, name } of REPRESENTATIVE_ITEMS) {
  test(`item ${id} (${name}) DTO matches snapshot`, () => {
    const base = getItemById("interlude", id);
    expect(base, `expected base item ${id} (${name}) to exist`).toBeDefined();
    const dto = toItemDetailDto(base!, "interlude");
    expect(dto).toMatchSnapshot();
  });
}

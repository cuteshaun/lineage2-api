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
];

for (const { id, name } of REPRESENTATIVE_ITEMS) {
  test(`item ${id} (${name}) DTO matches snapshot`, () => {
    const base = getItemById("interlude", id);
    expect(base, `expected base item ${id} (${name}) to exist`).toBeDefined();
    const dto = toItemDetailDto(base!, "interlude");
    expect(dto).toMatchSnapshot();
  });
}

import fs from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import type { ArmorSet } from "@/lib/types";

/**
 * Lock the parser output for `armor-sets.json` against representative sets.
 * Snapshot diffs surface any change to the `ArmorSet` shape, the `0`-sentinel
 * dropping, the synthetic id assignment, the skill-ref formatting, or the
 * shield/enchant6 conditional fields.
 *
 * Picked to cover the variety in `data/xml/armorSets.xml`:
 *  - Wooden Set            — smallest (chest + legs + head only, no shield, no enchant6)
 *  - Tallum Heavy Set      — mid (4 pieces, no shield, with enchant6)
 *  - Avadon Heavy Set      — full structure: 5 pieces + shield bonus + enchant6
 *  - Major Arcana Set      — caster set (4 pieces, no shield, with enchant6)
 *  - Imperial Crusader Set — largest (5 pieces + shield + enchant6)
 *
 * Regenerate with `pnpm test -- -u` if a parser change is intentional.
 */
const REPRESENTATIVE_SETS = [
  "Wooden Set",
  "Tallum Heavy Set",
  "Avadon Heavy Set",
  "Major Arcana Set",
  "Imperial Crusader Set",
];

const sets: ArmorSet[] = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../data/generated/interlude/armor-sets.json"),
    "utf-8"
  )
);

for (const name of REPRESENTATIVE_SETS) {
  test(`armor set "${name}" matches snapshot`, () => {
    const found = sets.find((s) => s.name === name);
    expect(found, `expected armor set "${name}" to exist`).toBeDefined();
    expect(found).toMatchSnapshot();
  });
}

// `armor-sets.catalog.snapshot.test.ts` already locks the full DTO catalog
// (id, name, pieces, bonus skills, etc.), which catches dropped sets,
// duplicates, and ordering changes far better than a length-only snapshot.
// No top-level count/structure snapshot lives here.

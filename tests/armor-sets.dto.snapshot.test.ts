import { expect, test } from "vitest";
import {
  toArmorSetDetailDto,
  toArmorSetListDto,
} from "@/lib/api/dto/armor-set";
import { getArmorSetById, getArmorSets } from "@/lib/data/indexes";

/**
 * Lock the public DTO output for armor sets — both list and detail
 * shapes. Any change to `ArmorSetListDto`, `ArmorSetDetailDto`, the
 * piece resolver, the bonus-skill resolver, the rounding rules
 * inherited from `resolveSkill`, or the conditional shield/enchant6
 * fields surfaces here as a snapshot diff.
 *
 * Detail fixtures cover the same five sets as the parser-level
 * snapshot suite for traceability:
 *  - Wooden Set            — smallest (chest + legs + head only)
 *  - Tallum Heavy Set      — mid (4 pieces, with enchant6)
 *  - Avadon Heavy Set      — full (5 pieces + shield + enchant6)
 *  - Major Arcana Set      — caster (4 pieces, with enchant6)
 *  - Imperial Crusader Set — largest (5 pieces + shield + enchant6)
 *
 * Regenerate with `pnpm test -- -u` if a DTO change is intentional.
 */
const REPRESENTATIVE_NAMES = [
  "Wooden Set",
  "Tallum Heavy Set",
  "Avadon Heavy Set",
  "Major Arcana Set",
  "Imperial Crusader Set",
];

function findIdByName(name: string): number | undefined {
  // Walk up to ~60 ids — there are 51 sets total.
  for (let id = 1; id <= 60; id++) {
    const set = getArmorSetById("interlude", id);
    if (set?.name === name) return id;
  }
  return undefined;
}

for (const name of REPRESENTATIVE_NAMES) {
  test(`armor set DTO "${name}" matches snapshot`, () => {
    const id = findIdByName(name);
    expect(id, `expected armor set "${name}" to exist`).toBeDefined();
    const set = getArmorSetById("interlude", id!);
    const dto = toArmorSetDetailDto(set!, "interlude");
    expect(dto).toMatchSnapshot();
  });
}

test("armor sets list DTO (first page) matches snapshot", () => {
  const result = getArmorSets("interlude", { limit: 50, offset: 0 });
  expect({
    total: result.total,
    items: result.data.map(toArmorSetListDto),
  }).toMatchSnapshot();
});

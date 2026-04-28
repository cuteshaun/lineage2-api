import { expect, test } from "vitest";
import { toClassDetailDto, toClassListDto } from "@/lib/api/dto/class";
import { getAllClasses, getClassById } from "@/lib/data/indexes";

/**
 * Lock the public DTO output for classes — list + 3 representative
 * detail fixtures. Any change to `ClassListDto`, `ClassDetailDto`,
 * `ClassSkillLearnDto`, the spellbook cross-link, the parent/child
 * derivation, or the skill-resolution path surfaces here as a snapshot
 * diff.
 *
 * Detail fixtures cover the three profession levels (base / 1st / 3rd).
 * 2nd-prof is intentionally skipped — its shape is identical to 1st,
 * just with a deeper parent link, and we don't need the third fixture.
 *
 * Regenerate with `pnpm test -- -u` if a DTO change is intentional.
 */
const REPRESENTATIVE_CLASSES: Array<{ id: number; name: string }> = [
  { id: 0, name: "Human Fighter" },         // base
  { id: 4, name: "Human Knight" },          // 1st profession (parent = 0)
  { id: 90, name: "Phoenix Knight" },       // 3rd profession (parent = Paladin = 5)
];

for (const { id, name } of REPRESENTATIVE_CLASSES) {
  test(`class ${id} (${name}) detail DTO matches snapshot`, () => {
    const base = getClassById("interlude", id);
    expect(base, `expected class ${id} (${name}) to exist`).toBeDefined();
    const dto = toClassDetailDto(base!, "interlude");
    expect(dto).toMatchSnapshot();
  });
}

test("classes list DTO matches snapshot", () => {
  const all = getAllClasses("interlude").map(toClassListDto);
  expect({ total: all.length, items: all }).toMatchSnapshot();
});

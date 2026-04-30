import { expect, test } from "vitest";
import { getAllQuests, getQuestById } from "@/lib/data/indexes";
import { toQuestDetailDto, toQuestListDto } from "@/lib/api/dto/quest";

/**
 * Lock the public DTO output for quests — list + 4 representative
 * detail fixtures. Any change to the parser, the proximity-based
 * reward heuristic, the role-dedup logic, or the resolver paths
 * surfaces here as a snapshot diff.
 *
 * Detail fixtures cover the parser variety:
 *  - Q001 — simple intro, 3 talk targets, 1 final reward, no level/race/class gates beyond minLvl=2.
 *  - Q105 — kill-quest with many monsters and a multi-currency reward (Coin of Magic).
 *  - Q401 — class-restriction (1st profession Human Fighter), exp/sp rewards.
 *  - Q211 — multi-step boss-kill with class gate, exercises the proximity heuristic on a longer file.
 *
 * Regenerate with `pnpm test -- -u` if a parser change is intentional.
 */
const REPRESENTATIVE_QUESTS: Array<{ id: number; name: string }> = [
  { id: 1, name: "Letters of Love" },
  { id: 105, name: "Skirmish with the Orcs" },
  { id: 401, name: "Path to a Warrior" },
  { id: 211, name: "Trial of the Challenger" },
];

for (const { id, name } of REPRESENTATIVE_QUESTS) {
  test(`quest ${id} (${name}) DTO matches snapshot`, () => {
    const q = getQuestById("interlude", id);
    expect(q, `expected quest ${id} (${name}) to exist`).toBeDefined();
    const dto = toQuestDetailDto(q!, "interlude");
    expect(dto).toMatchSnapshot();
  });
}

test("quests list DTO (full catalog) matches snapshot", () => {
  const all = getAllQuests("interlude").map((q) => toQuestListDto(q, "interlude"));
  expect({ total: all.length, items: all }).toMatchSnapshot();
});

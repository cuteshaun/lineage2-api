import { expect, test } from "vitest";
import { getRawNpcById } from "@/lib/data/indexes";
import { toNpcDetailDto } from "@/lib/api/dto/npc";

/**
 * Lock `NpcDetailDto` shape, including the M3 quest cross-links
 * (`startsQuests`, `involvedInQuests` with role classification).
 *
 * Fixtures:
 *  - **Darin (30048)** — Q001 start NPC. Locks `startsQuests` and the
 *    role-dedup rule (Darin is also a Q001 talk target, but as the
 *    start NPC the talk overlap is suppressed and Q001 doesn't
 *    re-appear in `involvedInQuests`).
 *  - **Hatar (27059)** — first kill target of Q105 (Skirmish with the
 *    Orcs). Locks `involvedInQuests` with `roles: ["kill"]`.
 */
const REPRESENTATIVE_NPCS: Array<{ id: number; label: string }> = [
  { id: 30048, label: "Darin (Q001 start)" },
  { id: 27059, label: "Hatar (Q105 kill target)" },
];

for (const { id, label } of REPRESENTATIVE_NPCS) {
  test(`npc ${id} (${label}) DTO matches snapshot`, () => {
    const npc = getRawNpcById("interlude", id);
    expect(npc, `expected NPC ${id} (${label}) to exist`).toBeDefined();
    const dto = toNpcDetailDto(npc!, "interlude");
    expect(dto).toMatchSnapshot();
  });
}

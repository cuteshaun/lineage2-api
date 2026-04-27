import { expect, test } from "vitest";
import { getAllArmorSets } from "@/lib/data/indexes";
import { toArmorSetDetailDto } from "@/lib/api/dto/armor-set";

/**
 * Locks the public output of the armor-sets catalog endpoint
 * (`GET /api/[chronicle]/armor-sets`). The endpoint returns full
 * `ArmorSetDetailDto[]` — there is no compact list shape and no
 * standalone detail endpoint, so this snapshot is the single
 * mechanical contract for catalog consumers.
 *
 * Why all 51 sets and not a curated subset: a stat-rounding /
 * description-resolution / piece-name regression on any individual
 * set surfaces here. The items snapshot suite (Tallum Helmet 547)
 * already covers the embedded `partOfSets[]` shape, so the lock here
 * is intentionally redundant on shape and additive on data coverage.
 *
 * Regenerate with `pnpm test -- -u` if the diff is intentional.
 */
test("armor-sets catalog (interlude) matches snapshot", () => {
  const dtos = getAllArmorSets("interlude").map((s) =>
    toArmorSetDetailDto(s, "interlude")
  );
  expect(dtos).toMatchSnapshot();
});

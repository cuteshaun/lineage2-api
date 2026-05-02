import { getRegions } from "@/lib/data/indexes";
import { toRegionRefDto } from "@/lib/api/dto/region";
import { jsonList, parseChronicleParam } from "@/lib/api/responses";

// Public catalog of named map regions for the chronicle (M4). Returns
// the upstream `mapRegions.xml` table — for Interlude that's the 19
// engine "death-teleport" regions (Talking Island Village, Town of
// Aden, …). Empty list when the chronicle ships no `mapRegions.xml`.
//
// Single-page response (no pagination params) — matches `/armor-sets`,
// since the catalog is small and fixed.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const regions = getRegions(parsed.chronicle).map(toRegionRefDto);
  return jsonList(regions, {
    total: regions.length,
    limit: regions.length,
    offset: 0,
  });
}

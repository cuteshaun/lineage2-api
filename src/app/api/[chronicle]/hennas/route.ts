import { getHennas } from "@/lib/data/indexes";
import { toHennaSummaryDto } from "@/lib/api/dto/henna";
import { jsonList, parseChronicleParam } from "@/lib/api/responses";

// Public catalog of henna symbols for the chronicle (M8). For Interlude
// that's 180 entries from upstream `hennas.xml`, with 171 of them
// carrying display fields decoded from `hennagrp-e.dat` and the
// trailing 9 (the +/- 4 "Greater II" tier) honestly emitting
// `displayName`/`iconFile`/`shortLabel: null` — see HennaSummaryDto.
//
// Single-page response (no pagination) — same shape as `/regions`,
// `/locations`, `/armor-sets`. The catalog is small and fixed.
//
// Hennas are dye/symbol mechanics (a stat-engraving consumed at the
// Symbol Maker), not cosmetic tattoos.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chronicle: string }> }
) {
  const parsed = parseChronicleParam(await params);
  if (!parsed.ok) return parsed.response;

  const hennas = getHennas(parsed.chronicle).map((h) =>
    toHennaSummaryDto(h, parsed.chronicle)
  );
  return jsonList(hennas, {
    total: hennas.length,
    limit: hennas.length,
    offset: 0,
  });
}

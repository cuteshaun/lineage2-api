import type { Chronicle } from "../../chronicles";
import type { Henna, Item } from "../../types";
import { getClassById, getItemById } from "../../data/indexes";
import { toClassRefDto, type ClassRefDto } from "./class";

/**
 * Stat-delta block for a henna symbol. Six optional signed integers,
 * one per L2 base attribute (Str / Con / Dex / Int / Men / Wit).
 * Missing keys mean "no change to this stat" — present keys are the
 * raw signed integers from `hennas.xml` (typically `+1..+4` /
 * `-1..-5`).
 *
 * Always included verbatim from source — we don't synthesize the
 * shape from `shortLabel`, and we don't normalize / collapse zero
 * deltas (none exist in source data).
 */
export interface HennaStatChangesDto {
  STR?: number;
  CON?: number;
  DEX?: number;
  INT?: number;
  MEN?: number;
  WIT?: number;
}

/**
 * Compact resolved reference to the dye item that engraves a henna.
 * One per `HennaSummaryDto` — the dye item is what the player buys
 * and consumes at the Symbol Maker. 1:1 with `symbolId` in source
 * data (verified at parse time).
 */
export interface DyeItemRefDto {
  /** Item id (e.g. `4445` for the *Dye of STR (Str+1 Con-3)*). */
  id: number;
  /** Item name from `items.json` (e.g. `"Dye of STR (Str+1 Con-3)"`). */
  name: string;
  /**
   * Item icon basename inside `public/icons/`. `null` when the dye
   * item has no resolved icon. Distinct from `HennaSummaryDto.iconFile`
   * — that one is the henna *symbol* icon, this one is the dye *item*
   * icon. Both can be present and they typically differ (`etc_str_hena_*`
   * vs. `etc_str_symbol_*`).
   */
  iconFile: string | null;
}

/**
 * Compact henna reference. The "row-renderable" summary used both as
 * the `/api/[chronicle]/hennas` catalog entry shape and embedded in
 * cross-links (`ItemDetailDto.henna?`,
 * `ClassDetailDto.allowedHennas?`).
 *
 * **Honest-fallback contract**: `displayName`, `iconFile`, and
 * `shortLabel` are nullable because the L2 client `hennagrp-e.dat`
 * uses a non-standard shared-prefix string compression for the +/-4
 * "Greater II" tier (Interlude symbols 172–180) that we do not
 * decode. Those rows ship mechanical data only — `statChanges`,
 * `price`, `dyeItem`, `allowedClassIds` are always populated; the
 * three display fields are honestly `null`. The 171 cleanly-decoded
 * rows carry full display data.
 */
export interface HennaSummaryDto {
  /** Source XML symbol id (1..N). Stable across builds. */
  symbolId: number;
  /**
   * Player-facing display name from the L2 client DAT (e.g.
   * `"Symbol of Strength"`). `null` for symbols whose DAT record
   * uses the unsupported shared-prefix encoding (Interlude
   * symbolId 172–180).
   */
  displayName: string | null;
  /**
   * Resolved PNG basename inside `public/icons/` (e.g.
   * `"etc_str_symbol_i00.png"`). Same convention as
   * `ItemDetailDto.iconFile`. `null` when the DAT does not carry
   * a clean icon slug for this symbol, or the file is missing on
   * disk.
   */
  iconFile: string | null;
  /**
   * Short stat label from the DAT (e.g. `"Str+1 Con-3"`). Verbatim —
   * we do **not** synthesize this from `statChanges`. `null` when
   * the DAT does not carry a clean record for this symbol.
   */
  shortLabel: string | null;
  /** Stat deltas applied while engraved. Always populated from XML. */
  statChanges: HennaStatChangesDto;
  /**
   * Adena cost the Symbol Maker NPC charges to engrave this symbol.
   * From upstream `hennas.xml`. **Distinct** from the dye item's
   * vendor-side item price (`ItemDetailDto.price` on the dye item
   * itself) — when an item-detail response embeds a `henna?` block,
   * `item.price` is the dye's base price and `item.henna.engravePrice`
   * is what the engraver charges to apply the symbol.
   */
  engravePrice: number;
  /**
   * The dye item that engraves this symbol. Resolved against
   * `items.json` at request time. 1:1 with `symbolId`.
   */
  dyeItem: DyeItemRefDto;
}

/**
 * Per-symbol detail. Same fields as `HennaSummaryDto` plus the
 * resolved class allow-list. Returned by `GET /hennas/[symbolId]`.
 *
 * `allowedClasses` is the full `ClassRefDto[]` (id + name +
 * professionLevel) — not the bare `number[]` from XML — so consumers
 * can render the class list without a second round-trip. Sorted by
 * class id ascending.
 */
export interface HennaDetailDto extends HennaSummaryDto {
  /** Classes permitted to engrave this symbol. Sorted by class id. */
  allowedClasses: ClassRefDto[];
}

function buildStatChanges(henna: Henna): HennaStatChangesDto {
  const out: HennaStatChangesDto = {};
  if (henna.statChanges.STR != null) out.STR = henna.statChanges.STR;
  if (henna.statChanges.CON != null) out.CON = henna.statChanges.CON;
  if (henna.statChanges.DEX != null) out.DEX = henna.statChanges.DEX;
  if (henna.statChanges.INT != null) out.INT = henna.statChanges.INT;
  if (henna.statChanges.MEN != null) out.MEN = henna.statChanges.MEN;
  if (henna.statChanges.WIT != null) out.WIT = henna.statChanges.WIT;
  return out;
}

function buildDyeItemRef(item: Item): DyeItemRefDto {
  return { id: item.id, name: item.name, iconFile: item.iconFile };
}

export function toHennaSummaryDto(
  henna: Henna,
  chronicle: Chronicle
): HennaSummaryDto {
  // Cross-validation at build time guarantees the dye item exists;
  // we reach for it loudly at runtime so that any future drift
  // surfaces as a route 500, not a silently-broken cross-link.
  const dyeItem = getItemById(chronicle, henna.dyeItemId);
  if (!dyeItem) {
    throw new Error(
      `[henna ${henna.symbolId}] dyeItemId=${henna.dyeItemId} did not resolve at request time`
    );
  }
  return {
    symbolId: henna.symbolId,
    displayName: henna.displayName,
    iconFile: henna.iconFile,
    shortLabel: henna.shortLabel,
    statChanges: buildStatChanges(henna),
    engravePrice: henna.price,
    dyeItem: buildDyeItemRef(dyeItem),
  };
}

export function toHennaDetailDto(
  henna: Henna,
  chronicle: Chronicle
): HennaDetailDto {
  const summary = toHennaSummaryDto(henna, chronicle);
  const allowedClasses: ClassRefDto[] = [];
  for (const cid of henna.allowedClassIds) {
    const cls = getClassById(chronicle, cid);
    if (!cls) {
      throw new Error(
        `[henna ${henna.symbolId}] allowedClassId=${cid} did not resolve at request time`
      );
    }
    allowedClasses.push(toClassRefDto(cls));
  }
  return { ...summary, allowedClasses };
}

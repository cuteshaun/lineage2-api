import type { EnrichedDrop, EnrichedNpcDrops } from "../drops";
import type { ItemSourceEntry } from "../../data/indexes";

export interface DropDto {
  itemId: number;
  itemName: string | null;
  qty: string;
  chance: number | null;
  chanceDisplay: string | null;
  type: "spoil" | "adena" | "regular";
}

export interface NpcDropsDto {
  npcId: number;
  npcName: string;
  drops: DropDto[];
}

function rawToPercent(raw: number | null): number | null {
  if (raw == null) return null;
  return raw / 10000;
}

function formatChanceDisplay(pct: number | null): string | null {
  if (pct == null) return null;
  if (pct >= 0.01) {
    return `${parseFloat(pct.toFixed(2))}%`;
  }
  // "1 in X" display for very rare drops.
  const oneIn = Math.round(100 / pct);
  return `1/${oneIn.toLocaleString("en-US")}`;
}

function formatQty(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min == null) return String(max);
  if (max == null) return String(min);
  if (min === max) return String(min);
  return `${min}–${max}`;
}

function toDropDto(drop: EnrichedDrop): DropDto {
  const chance = rawToPercent(drop.chance);
  return {
    itemId: drop.itemId,
    itemName: drop.itemName,
    qty: formatQty(drop.min, drop.max),
    chance,
    chanceDisplay: formatChanceDisplay(chance),
    type: drop.type,
  };
}

export function toNpcDropsDto(drops: EnrichedNpcDrops): NpcDropsDto {
  return {
    npcId: drops.npcId,
    npcName: drops.npcName,
    drops: drops.drops.map(toDropDto),
  };
}

// --- Item source DTOs (dropped-by / spoiled-by reverse lookups) ---

export interface ItemSourceNpcDto {
  id: number;
  name: string;
  type: string | null;
  level: number | null;
}

export interface ItemSourceEntryDto {
  npc: ItemSourceNpcDto;
  qty: string;
  chance: number | null;
  chanceDisplay: string | null;
}

export interface ItemSourcesResponseDto {
  sources: ItemSourceEntryDto[];
  meta: { itemId: number; total: number };
}

function toItemSourceEntryDto(entry: ItemSourceEntry): ItemSourceEntryDto {
  const chance = rawToPercent(entry.entry.chance);
  return {
    npc: entry.npc,
    qty: formatQty(entry.entry.min, entry.entry.max),
    chance,
    chanceDisplay: formatChanceDisplay(chance),
  };
}

export function toItemSourcesResponseDto(
  sources: ItemSourceEntry[],
  itemId: number
): ItemSourcesResponseDto {
  return {
    sources: sources.map(toItemSourceEntryDto),
    meta: { itemId, total: sources.length },
  };
}

function compareItemSources(a: ItemSourceEntry, b: ItemSourceEntry): number {
  // chance desc (null last)
  const ca = a.entry.chance;
  const cb = b.entry.chance;
  if (ca !== cb) {
    if (ca === null) return 1;
    if (cb === null) return -1;
    if (cb !== ca) return cb - ca;
  }
  // level asc (null last)
  const la = a.npc.level;
  const lb = b.npc.level;
  if (la !== lb) {
    if (la === null) return 1;
    if (lb === null) return -1;
    if (la !== lb) return la - lb;
  }
  // name asc
  const nc = a.npc.name.localeCompare(b.npc.name);
  if (nc !== 0) return nc;
  // id asc
  return a.npc.id - b.npc.id;
}

export function toItemSourcesPageDto(
  sources: ItemSourceEntry[],
  limit: number,
  offset: number
): { data: ItemSourceEntryDto[]; total: number } {
  const sorted = [...sources].sort(compareItemSources);
  const page = sorted.slice(offset, offset + limit);
  return {
    data: page.map(toItemSourceEntryDto),
    total: sources.length,
  };
}

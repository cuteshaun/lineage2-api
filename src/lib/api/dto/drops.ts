import type { EnrichedDrop, EnrichedNpcDrops } from "../drops";
import type { ItemSourceEntry } from "../../data/indexes";

export interface DropDto {
  itemId: number;
  itemName: string | null;
  qty: string;
  chance: string | null;
  type: "spoil" | "adena" | "regular";
}

export interface NpcDropsDto {
  npcId: number;
  npcName: string;
  drops: DropDto[];
}

function formatChance(raw: number | null): string | null {
  if (raw == null) return null;
  const pct = raw / 10000;
  if (pct >= 10) return `${parseFloat(pct.toFixed(1))}%`;
  if (pct >= 1) return `${parseFloat(pct.toFixed(2))}%`;
  const formatted = parseFloat(pct.toFixed(3));
  if (formatted === 0 && raw > 0) return "<0.001%";
  return `${formatted}%`;
}

function formatQty(min: number | null, max: number | null): string {
  if (min == null && max == null) return "—";
  if (min == null) return String(max);
  if (max == null) return String(min);
  if (min === max) return String(min);
  return `${min}–${max}`;
}

function toDropDto(drop: EnrichedDrop): DropDto {
  return {
    itemId: drop.itemId,
    itemName: drop.itemName,
    qty: formatQty(drop.min, drop.max),
    chance: formatChance(drop.chance),
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
  chance: string | null;
}

export interface ItemSourcesResponseDto {
  sources: ItemSourceEntryDto[];
  meta: { itemId: number; total: number };
}

function toItemSourceEntryDto(entry: ItemSourceEntry): ItemSourceEntryDto {
  return {
    npc: entry.npc,
    qty: formatQty(entry.entry.min, entry.entry.max),
    chance: formatChance(entry.entry.chance),
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

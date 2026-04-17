import type { EnrichedDrop, EnrichedNpcDrops } from "../drops";

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
  if (pct >= 1 && pct === Math.floor(pct)) return `${pct}%`;
  return `${parseFloat(pct.toFixed(2))}%`;
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

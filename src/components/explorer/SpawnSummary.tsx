"use client";

import { useState } from "react";
import { SpawnMap } from "./SpawnMap";
import type { EnrichedSpawnDto } from "@/lib/api/dto/spawn";

function formatRespawn(spawns: EnrichedSpawnDto[]): string {
  const delays = [...new Set(spawns.map((s) => s.respawnDelay))];
  if (delays.length === 0) return "—";
  if (delays.length === 1) {
    const d = delays[0];
    if (d <= 0) return "Instant";
    if (d >= 3600) return `${Math.round(d / 3600)}h`;
    if (d >= 60) return `${Math.round(d / 60)}m`;
    return `${d}s`;
  }
  const min = Math.min(...delays);
  const max = Math.max(...delays);
  const fmt = (d: number) => (d >= 60 ? `${Math.round(d / 60)}m` : `${d}s`);
  return `${fmt(min)}–${fmt(max)}`;
}

function formatPeriod(spawns: EnrichedSpawnDto[]): string {
  const periods = [...new Set(spawns.map((s) => s.periodOfDay))].sort();
  const labels: Record<number, string> = { 0: "All day", 1: "Day", 2: "Night" };
  if (periods.length === 1) return labels[periods[0]] ?? String(periods[0]);
  return periods.map((p) => labels[p] ?? String(p)).join(", ");
}

/**
 * Renders the per-region spawn breakdown. When every spawn shares
 * the same region, shows just the name. When spawns split across
 * regions, shows each region with its count. When no spawn carries
 * a resolved region (out-of-grid coords), shows "—".
 */
function formatRegions(spawns: EnrichedSpawnDto[]): string {
  const counts = new Map<number, { name: string; count: number }>();
  for (const s of spawns) {
    if (!s.region) continue;
    const existing = counts.get(s.region.id);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(s.region.id, { name: s.region.name, count: 1 });
    }
  }
  if (counts.size === 0) return "—";
  const sorted = [...counts.values()].sort((a, b) =>
    b.count - a.count || a.name.localeCompare(b.name)
  );
  if (sorted.length === 1) return sorted[0].name;
  return sorted.map((r) => `${r.name} (${r.count})`).join(", ");
}

export function SpawnSummary({ spawns }: { spawns: EnrichedSpawnDto[] }) {
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono text-xs">
        <dt className="text-zinc-500 dark:text-zinc-400">Spawn points</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">{spawns.length}</dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Respawn</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">
          {formatRespawn(spawns)}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Time</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">
          {formatPeriod(spawns)}
        </dd>
        <dt className="text-zinc-500 dark:text-zinc-400">Region</dt>
        <dd className="text-zinc-900 dark:text-zinc-100">
          {formatRegions(spawns)}
        </dd>
      </dl>

      <button
        type="button"
        onClick={() => setMapOpen(!mapOpen)}
        className="inline-flex w-fit items-center gap-1.5 rounded border border-zinc-300 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {mapOpen ? "Hide map" : "Show on map"}
      </button>

      {mapOpen && <SpawnMap spawns={spawns} />}
    </div>
  );
}

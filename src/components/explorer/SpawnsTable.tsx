import type { Spawn } from "@/lib/types";

/**
 * Compact read-only table for raw spawn rows as returned by
 * `/api/[chronicle]/npcs/[id]/spawns`. No enrichment: coordinates and
 * timings are shown exactly as they appear in the upstream dataset.
 * `periodOfDay` is the only cosmetic mapping (0 → Any, 1 → Day, 2 → Night).
 */
export function SpawnsTable({ spawns }: { spawns: Spawn[] }) {
  if (spawns.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        No spawn data for this NPC.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left font-mono text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 text-right">X</th>
            <th className="px-3 py-2 text-right">Y</th>
            <th className="px-3 py-2 text-right">Z</th>
            <th className="px-3 py-2 text-right">Heading</th>
            <th className="px-3 py-2 text-right">Respawn</th>
            <th className="px-3 py-2 text-right">Random</th>
            <th className="px-3 py-2">Period</th>
          </tr>
        </thead>
        <tbody>
          {spawns.map((s, idx) => (
            <tr
              key={`${s.x}-${s.y}-${s.z}-${idx}`}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {s.x.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {s.y.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {s.z.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {s.heading}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {s.respawnDelay}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {s.respawnRandom}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {formatPeriod(s.periodOfDay)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatPeriod(value: number): string {
  switch (value) {
    case 0:
      return "Any";
    case 1:
      return "Day";
    case 2:
      return "Night";
    default:
      return String(value);
  }
}

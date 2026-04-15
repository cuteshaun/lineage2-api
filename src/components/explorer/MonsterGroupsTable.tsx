import Link from "next/link";
import type { MonsterGroupSummary } from "@/lib/api/monster-groups";

/**
 * List table for the public monster list, which now returns monster GROUPS
 * (one entry per exact name) instead of flat canonical templates. Columns
 * are restricted to fields the backend aggregates safely — no single-variant
 * stats are surfaced here. See `MonsterGroupSummary` in
 * `@/lib/api/monster-groups` for the exact shape.
 */
export function MonsterGroupsTable({
  basePath,
  rows,
}: {
  basePath: string;
  rows: MonsterGroupSummary[];
}) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left font-mono text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="w-20 px-3 py-2 text-right">ID</th>
            <th className="px-3 py-2">Name</th>
            <th className="w-24 px-3 py-2 text-right">Variants</th>
            <th className="px-3 py-2">Level</th>
            <th className="px-3 py-2">Types</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr
              key={g.id}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {g.id}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`${basePath}/${g.id}`}
                  className="text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {g.name}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {g.variantsCount}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {formatLevelRange(g.levelRange)}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {g.npcTypes.length > 0 ? g.npcTypes.join(", ") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatLevelRange(
  range: MonsterGroupSummary["levelRange"]
): string {
  if (!range) return "—";
  if (range.min === range.max) return String(range.min);
  return `${range.min}–${range.max}`;
}

import Link from "next/link";
import type { ItemSourceEntry } from "@/lib/data/indexes";

/**
 * Renders a table of NPCs that drop or spoil a given item. Shared between
 * the "Dropped by" and "Spoiled by" sections on item detail pages.
 */
export function ItemSourceTable({
  chronicle,
  sources,
  emptyMessage,
}: {
  chronicle: string;
  sources: ItemSourceEntry[];
  emptyMessage: string;
}) {
  if (sources.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left font-mono text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="w-20 px-3 py-2 text-right">NPC ID</th>
            <th className="px-3 py-2">NPC</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Lv</th>
            <th className="px-3 py-2 text-right">Min</th>
            <th className="px-3 py-2 text-right">Max</th>
            <th className="px-3 py-2 text-right">Chance</th>
            <th className="px-3 py-2 text-right">Cat</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s, idx) => (
            <tr
              key={`${s.npc.id}-${s.entry.category}-${idx}`}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {s.npc.id}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/${chronicle}/npcs/${s.npc.id}`}
                  className="text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {s.npc.name}
                </Link>
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {s.npc.type ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {s.npc.level ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {s.entry.min ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {s.entry.max ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {s.entry.chance?.toLocaleString() ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {s.entry.category ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

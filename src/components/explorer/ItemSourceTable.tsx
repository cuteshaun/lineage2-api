import Link from "next/link";
import type { ItemSourceEntryDto } from "@/lib/api/dto/drops";

export function ItemSourceTable({
  chronicle,
  sources,
  emptyMessage,
}: {
  chronicle: string;
  sources: ItemSourceEntryDto[];
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
            <th className="px-3 py-2">NPC</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Lvl</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Chance</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s, idx) => (
            <tr
              key={`${s.npc.id}-${idx}`}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
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
                {s.qty}
                {s.rollCount && s.rollCount > 1 && (
                  <span className="ml-1.5 text-zinc-400 dark:text-zinc-500">
                    ×{s.rollCount}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {s.chanceDisplay ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import type { Npc } from "@/lib/types";

/**
 * Shared NPC list table used by both /[chronicle]/npcs and
 * /[chronicle]/monsters. `basePath` controls which detail route each row
 * links to.
 */
export function NpcsTable({
  basePath,
  rows,
}: {
  basePath: string;
  rows: Npc[];
}) {
  return (
    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left font-mono text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="w-20 px-3 py-2 text-right">ID</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Lv</th>
            <th className="px-3 py-2 text-right">HP</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((npc) => (
            <tr
              key={npc.id}
              className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {npc.id}
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`${basePath}/${npc.id}`}
                  className="text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {npc.name}
                </Link>
                {npc.mergedCount > 1 && (
                  <span className="ml-2 inline-block rounded bg-zinc-200 px-1.5 py-0.5 align-middle font-mono text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                    ×{npc.mergedCount}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                {npc.title ?? "—"}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {npc.npcType ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {npc.level ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                {npc.hp !== null ? Math.round(npc.hp).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

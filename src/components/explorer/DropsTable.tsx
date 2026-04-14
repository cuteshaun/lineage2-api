import Link from "next/link";
import type { Chronicle } from "@/lib/chronicles";

export interface EnrichedDrop {
  itemId: number;
  itemName: string | null;
  min: number | null;
  max: number | null;
  chance: number | null;
  category: number | null;
  type: "spoil" | "adena" | "regular";
}

const typeLabel: Record<EnrichedDrop["type"], string> = {
  spoil: "spoil",
  adena: "adena",
  regular: "regular",
};

const typeStyle: Record<EnrichedDrop["type"], string> = {
  spoil:
    "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  adena:
    "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-200",
  regular:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function DropsTable({
  chronicle,
  drops,
}: {
  chronicle: Chronicle;
  drops: EnrichedDrop[];
}) {
  if (drops.length === 0) {
    return (
      <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        No drops for this NPC.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left font-mono text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Min</th>
            <th className="px-3 py-2 text-right">Max</th>
            <th className="px-3 py-2 text-right">Chance</th>
            <th className="px-3 py-2 text-right">Cat</th>
          </tr>
        </thead>
        <tbody>
          {drops.map((drop, idx) => (
            <tr
              key={`${drop.category ?? "?"}-${drop.itemId}-${idx}`}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/${chronicle}/items/${drop.itemId}`}
                  className="font-mono text-zinc-900 hover:underline dark:text-zinc-100"
                >
                  {drop.itemName ?? `#${drop.itemId}`}
                </Link>
                <span className="ml-2 font-mono text-xs text-zinc-400">
                  #{drop.itemId}
                </span>
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block rounded px-2 py-0.5 font-mono text-xs ${typeStyle[drop.type]}`}
                >
                  {typeLabel[drop.type]}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                {drop.min ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                {drop.max ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                {drop.chance?.toLocaleString() ?? "—"}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {drop.category ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

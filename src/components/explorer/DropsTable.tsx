import Link from "next/link";
import type { Chronicle } from "@/lib/chronicles";
import type { DropDto } from "@/lib/api/dto/drops";

const typeLabel: Record<DropDto["type"], string> = {
  spoil: "spoil",
  adena: "adena",
  regular: "regular",
};

const typeStyle: Record<DropDto["type"], string> = {
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
  drops: DropDto[];
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
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Chance</th>
          </tr>
        </thead>
        <tbody>
          {drops.map((drop, idx) => (
            <tr
              key={`${drop.itemId}-${idx}`}
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
                {drop.qty}
              </td>
              <td className="px-3 py-2 text-right font-mono text-zinc-700 dark:text-zinc-300">
                {drop.chance ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

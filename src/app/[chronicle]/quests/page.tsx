import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetchList } from "@/lib/api/client";
import type { QuestListDto } from "@/lib/api/dto/quest";

// On-demand ISR: generated on first request, cached until the next
// deploy (see lib/api/client.ts).
export async function generateStaticParams() {
  return [];
}

export default async function QuestsPage({
  params,
}: {
  params: Promise<{ chronicle: string }>;
}) {
  const { chronicle } = await params;
  if (!isChronicle(chronicle)) notFound();

  const result = await apiFetchList<QuestListDto>(`/api/${chronicle}/quests`);
  // Throw on failure: under ISR a rendered error block would be cached
  // until the next deploy; a failed generation is not cached and retried.
  if (!result.ok) throw new Error(result.error);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Quests
        </h1>
        <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {result.meta.total.toLocaleString()} total
        </span>
      </header>

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left font-mono text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="w-16 px-3 py-2 text-right">ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="w-12 px-3 py-2 text-right">Lvl</th>
                <th className="w-20 px-3 py-2 text-center">Repeat</th>
                <th className="px-3 py-2">Race</th>
                <th className="px-3 py-2">Class</th>
                <th className="px-3 py-2">Start NPC</th>
                <th className="w-32 px-3 py-2 text-right">Rewards</th>
              </tr>
            </thead>
            <tbody>
              {result.data.map((q) => (
                <tr
                  key={q.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {q.id}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/${chronicle}/quests/${q.id}`}
                      className="text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {q.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {q.levelMin ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-[10px]">
                    {q.repeatable === true ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        ↻
                      </span>
                    ) : q.repeatable === false ? (
                      <span className="text-zinc-400 dark:text-zinc-600">
                        once
                      </span>
                    ) : (
                      <span className="text-zinc-300 dark:text-zinc-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                    {q.raceRestrictions.length > 0
                      ? q.raceRestrictions.join(", ")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                    {q.classRestrictions.length > 0
                      ? q.classRestrictions.map((c) => c.name).join(", ")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {q.startNpc ? (
                      <Link
                        href={`/${chronicle}/npcs/${q.startNpc.id}`}
                        className="text-zinc-900 hover:underline dark:text-zinc-100"
                      >
                        {q.startNpc.name}
                      </Link>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RewardsPreview preview={q.rewardsPreview} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
}

function RewardsPreview({
  preview,
}: {
  preview: QuestListDto["rewardsPreview"];
}) {
  const parts: string[] = [];
  if (preview.adena) parts.push(`${preview.adena.toLocaleString()} a`);
  if (preview.exp) parts.push(`${preview.exp.toLocaleString()} XP`);
  if (preview.sp) parts.push(`${preview.sp.toLocaleString()} SP`);
  if (preview.itemCount > 0) {
    parts.push(`${preview.itemCount} item${preview.itemCount === 1 ? "" : "s"}`);
  }
  if (parts.length === 0) {
    return <span className="text-zinc-400 dark:text-zinc-600">—</span>;
  }
  return (
    <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
      {parts.join(" · ")}
    </span>
  );
}

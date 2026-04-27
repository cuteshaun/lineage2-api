import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetchList } from "@/lib/api/client";
import { ArmorSetCard } from "@/components/explorer/ArmorSetCard";
import type { ArmorSetDetailDto } from "@/lib/api/dto/armor-set";

export default async function ArmorSetsPage({
  params,
}: {
  params: Promise<{ chronicle: string }>;
}) {
  const { chronicle } = await params;
  if (!isChronicle(chronicle)) notFound();

  const sets = await apiFetchList<ArmorSetDetailDto>(
    `/api/${chronicle}/armor-sets`
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Armor Sets
        </h1>
        {sets.ok && (
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {sets.meta.total.toLocaleString()} total
          </span>
        )}
      </header>

      {!sets.ok ? (
        <ErrorBlock message={sets.error} />
      ) : sets.data.length === 0 ? (
        <EmptyBlock />
      ) : (
        <div className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {sets.data.map((set) => (
            <div key={set.id} className="p-4">
              <ArmorSetCard chronicle={chronicle} set={set} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      No armor sets available.
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      {message}
    </div>
  );
}

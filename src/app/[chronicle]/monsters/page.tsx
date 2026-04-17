import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetchList } from "@/lib/api/client";
import { NpcFilters } from "@/components/explorer/NpcFilters";
import { NpcsTable } from "@/components/explorer/NpcsTable";
import { Pagination } from "@/components/explorer/Pagination";
import type { NpcListDto } from "@/lib/api/dto/npc";
import type { NpcTypeSummary } from "@/lib/data/indexes";

const DEFAULT_LIMIT = 50;

type SearchParams = Record<string, string | string[] | undefined>;

function getOne(
  params: SearchParams,
  key: string,
  fallback: string = ""
): string {
  const v = params[key];
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

function buildApiPath(
  chronicle: string,
  params: SearchParams,
  limit: number,
  offset: number
): string {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  if (offset > 0) qs.set("offset", String(offset));
  for (const key of ["q", "npcType", "levelMin", "levelMax", "sort"] as const) {
    const v = getOne(params, key);
    if (v) qs.set(key, v);
  }
  return `/api/${chronicle}/monsters?${qs.toString()}`;
}

export default async function MonstersPage({
  params,
  searchParams,
}: {
  params: Promise<{ chronicle: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { chronicle } = await params;
  if (!isChronicle(chronicle)) notFound();

  const sp = await searchParams;
  const limit = DEFAULT_LIMIT;
  const offset = Math.max(0, parseInt(getOne(sp, "offset", "0"), 10) || 0);

  const [monsters, npcTypes] = await Promise.all([
    apiFetchList<NpcListDto>(buildApiPath(chronicle, sp, limit, offset)),
    apiFetchList<NpcTypeSummary>(`/api/${chronicle}/meta/npc-types`),
  ]);

  const basePath = `/${chronicle}/monsters`;
  const monsterTypes = npcTypes.ok
    ? npcTypes.data.filter((t) => t.isMonster).map((t) => t.name)
    : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Monsters
        </h1>
        {monsters.ok && (
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {monsters.meta.total.toLocaleString()} total
          </span>
        )}
      </header>

      <div className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <NpcFilters basePath={basePath} npcTypes={monsterTypes} />
      </div>

      {!monsters.ok ? (
        <ErrorBlock message={monsters.error} />
      ) : monsters.data.length === 0 ? (
        <EmptyBlock />
      ) : (
        <NpcsTable basePath={basePath} rows={monsters.data} />
      )}

      {monsters.ok && (
        <Pagination
          basePath={basePath}
          searchParams={sp}
          total={monsters.meta.total}
          limit={monsters.meta.limit}
          offset={monsters.meta.offset}
        />
      )}
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      No monsters match your filters.
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetchList } from "@/lib/api/client";
import { Pagination } from "@/components/explorer/Pagination";
import type { ArmorSetListDto } from "@/lib/api/dto/armor-set";

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
  const q = getOne(params, "q");
  if (q) qs.set("q", q);
  return `/api/${chronicle}/armor-sets?${qs.toString()}`;
}

export default async function ArmorSetsPage({
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
  const q = getOne(sp, "q");

  const sets = await apiFetchList<ArmorSetListDto>(
    buildApiPath(chronicle, sp, limit, offset)
  );

  const basePath = `/${chronicle}/armor-sets`;

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

      <div className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <form className="flex items-center gap-3" action={basePath}>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name…"
            className="flex-1 rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            type="submit"
            className="rounded border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          >
            Search
          </button>
        </form>
      </div>

      {!sets.ok ? (
        <ErrorBlock message={sets.error} />
      ) : sets.data.length === 0 ? (
        <EmptyBlock />
      ) : (
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left font-mono text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="w-20 px-3 py-2 text-right">ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2 text-right">Pieces</th>
              </tr>
            </thead>
            <tbody>
              {sets.data.map((set) => (
                <tr
                  key={set.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {set.id}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`${basePath}/${set.id}`}
                      title={set.name}
                      className="text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {set.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {set.pieceCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sets.ok && (
        <Pagination
          basePath={basePath}
          searchParams={sp}
          total={sets.meta.total}
          limit={sets.meta.limit}
          offset={sets.meta.offset}
        />
      )}
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      No armor sets match your search.
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

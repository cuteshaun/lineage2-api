import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetchList } from "@/lib/api/client";
import { ItemFilters } from "@/components/explorer/ItemFilters";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import { Pagination } from "@/components/explorer/Pagination";
import type { Item } from "@/lib/types";
import type { NameCount } from "@/lib/data/indexes";

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
  for (const key of ["q", "type", "grade", "sort"] as const) {
    const v = getOne(params, key);
    if (v) qs.set(key, v);
  }
  return `/api/${chronicle}/items?${qs.toString()}`;
}

export default async function ItemsPage({
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

  const [items, itemTypes, itemGrades] = await Promise.all([
    apiFetchList<Item>(buildApiPath(chronicle, sp, limit, offset)),
    apiFetchList<NameCount>(`/api/${chronicle}/meta/item-types`),
    apiFetchList<NameCount>(`/api/${chronicle}/meta/item-grades`),
  ]);

  const basePath = `/${chronicle}/items`;
  const types = itemTypes.ok ? itemTypes.data.map((t) => t.name) : [];
  const grades = itemGrades.ok ? itemGrades.data.map((g) => g.name) : [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Items
        </h1>
        {items.ok && (
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {items.meta.total.toLocaleString()} total
          </span>
        )}
      </header>

      <div className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <ItemFilters basePath={basePath} types={types} grades={grades} />
      </div>

      {!items.ok ? (
        <ErrorBlock message={items.error} />
      ) : items.data.length === 0 ? (
        <EmptyBlock />
      ) : (
        <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left font-mono text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="w-20 px-3 py-2 text-right">ID</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="px-3 py-2 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {items.data.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {item.id}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`${basePath}/${item.id}`}
                      title={item.name}
                      className="flex items-center gap-3 text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      <ItemIcon iconFile={item.iconFile} name={item.name} />
                      <span>{item.name}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {item.type}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs uppercase text-zinc-600 dark:text-zinc-400">
                    {item.grade}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {item.weight?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {item.price?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {items.ok && (
        <Pagination
          basePath={basePath}
          searchParams={sp}
          total={items.meta.total}
          limit={items.meta.limit}
          offset={items.meta.offset}
        />
      )}
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      No items match your filters.
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

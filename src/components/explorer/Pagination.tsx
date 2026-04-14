import Link from "next/link";

/**
 * Link-based pagination — uses <Link> with preserved query params rather
 * than client-side state. Safe to render in a server component.
 */
export function Pagination({
  basePath,
  searchParams,
  total,
  limit,
  offset,
}: {
  basePath: string;
  searchParams: Record<string, string | string[] | undefined>;
  total: number;
  limit: number;
  offset: number;
}) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const buildHref = (nextOffset: number): string => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "offset") continue;
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(key, v);
      } else {
        params.set(key, value);
      }
    }
    if (nextOffset > 0) params.set("offset", String(nextOffset));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < total;

  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <div className="text-zinc-600 dark:text-zinc-400">
        {total === 0
          ? "No results"
          : `Page ${page} of ${totalPages} · ${total.toLocaleString()} results`}
      </div>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link
            href={buildHref(prevOffset)}
            className="rounded border border-zinc-300 bg-white px-3 py-1 text-zinc-900 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600"
          >
            ← Prev
          </Link>
        ) : (
          <span className="rounded border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-600">
            ← Prev
          </span>
        )}
        {hasNext ? (
          <Link
            href={buildHref(nextOffset)}
            className="rounded border border-zinc-300 bg-white px-3 py-1 text-zinc-900 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600"
          >
            Next →
          </Link>
        ) : (
          <span className="rounded border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-600">
            Next →
          </span>
        )}
      </div>
    </div>
  );
}

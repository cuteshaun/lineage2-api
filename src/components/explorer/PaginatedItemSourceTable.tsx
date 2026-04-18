"use client";

import { useState, useCallback } from "react";
import type { ItemSourceEntryDto } from "@/lib/api/dto/drops";
import { ItemSourceTable } from "./ItemSourceTable";

export function PaginatedItemSourceTable({
  chronicle,
  initialSources,
  total,
  limit,
  fetchUrl,
  emptyMessage,
}: {
  chronicle: string;
  initialSources: ItemSourceEntryDto[];
  total: number;
  limit: number;
  fetchUrl: string;
  emptyMessage: string;
}) {
  const [sources, setSources] = useState(initialSources);
  const [loading, setLoading] = useState(false);

  const hasMore = sources.length < total;

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${fetchUrl}?limit=${limit}&offset=${sources.length}`
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        data: ItemSourceEntryDto[];
      };
      setSources((prev) => [...prev, ...body.data]);
    } finally {
      setLoading(false);
    }
  }, [fetchUrl, limit, sources.length]);

  return (
    <div>
      <ItemSourceTable
        chronicle={chronicle}
        sources={sources}
        emptyMessage={emptyMessage}
      />
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="mt-3 w-full rounded border border-zinc-200 bg-zinc-50 px-4 py-2 font-mono text-xs text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          {loading
            ? "Loading..."
            : `Show more (${sources.length} of ${total})`}
        </button>
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetchList } from "@/lib/api/client";
import type { LocationRefDto } from "@/lib/api/dto/location";

// On-demand ISR: generated on first request, cached until the next
// deploy (see lib/api/client.ts).
export async function generateStaticParams() {
  return [];
}

export default async function LocationsPage({
  params,
}: {
  params: Promise<{ chronicle: string }>;
}) {
  const { chronicle } = await params;
  if (!isChronicle(chronicle)) notFound();

  const locations = await apiFetchList<LocationRefDto>(
    `/api/${chronicle}/locations`
  );
  // Throw on failure: under ISR a rendered error block would be cached
  // until the next deploy; a failed generation is not cached and retried.
  if (!locations.ok) throw new Error(locations.error);

  // Sort by minLevel ascending (nulls last — towns / non-combat
  // areas), then by name. Browsable as "what can I hunt at level N".
  const sorted = [...locations.data].sort((a, b) => {
    if (a.minLevel == null && b.minLevel == null)
      return a.name.localeCompare(b.name);
    if (a.minLevel == null) return 1;
    if (b.minLevel == null) return -1;
    return a.minLevel - b.minLevel || a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Locations
          </h1>
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {locations.meta.total.toLocaleString()} total
          </span>
        </div>
        <p className="max-w-prose text-sm text-zinc-600 dark:text-zinc-400">
          Player-facing hunting / map locations from the L2 client&apos;s{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
            huntingzone-e.dat
          </code>
          . Each entry is a single center anchor with a recommended level —
          spawns and detail responses resolve to the nearest anchor within
          a 10000-unit threshold. Not polygon-accurate; treat as a
          player-facing hint, not a precise zone.
        </p>
      </header>

      {sorted.length === 0 ? (
        <EmptyBlock />
      ) : (
        <ul className="grid grid-cols-1 gap-1 rounded border border-zinc-200 bg-white p-2 sm:grid-cols-2 lg:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-950">
          {sorted.map((loc) => (
            <li
              key={loc.id}
              className="flex items-baseline justify-between gap-3 rounded px-3 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span className="text-zinc-900 dark:text-zinc-100">
                {loc.name}
              </span>
              <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {loc.minLevel != null ? `Lv ${loc.minLevel}+` : "—"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      No locations available for this chronicle.
    </div>
  );
}

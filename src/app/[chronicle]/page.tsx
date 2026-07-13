import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetchList } from "@/lib/api/client";
import type { NameCount, NpcTypeSummary } from "@/lib/data/indexes";

// On-demand ISR: no params prerendered at build (pages dogfood the HTTP
// API, unreachable at build time — see lib/api/client.ts); each path is
// generated on first request and cached until the next deploy.
export async function generateStaticParams() {
  return [];
}

export default async function ChronicleHome({
  params,
}: {
  params: Promise<{ chronicle: string }>;
}) {
  const { chronicle } = await params;
  if (!isChronicle(chronicle)) notFound();

  // Pull totals from the meta endpoints to show real counts on the landing.
  const [itemTypes, npcTypes] = await Promise.all([
    apiFetchList<NameCount>(`/api/${chronicle}/meta/item-types`),
    apiFetchList<NpcTypeSummary>(`/api/${chronicle}/meta/npc-types`),
  ]);

  // Throw on failure: under ISR a degraded render would be cached until
  // the next deploy; a failed generation is not cached and is retried.
  if (!itemTypes.ok) throw new Error(itemTypes.error);
  if (!npcTypes.ok) throw new Error(npcTypes.error);

  const itemCount = itemTypes.data.reduce((sum, t) => sum + t.count, 0);
  const npcCount = npcTypes.data.reduce((sum, t) => sum + t.count, 0);
  const monsterCount = npcTypes.data
    .filter((t) => t.isMonster)
    .reduce((sum, t) => sum + t.count, 0);

  const cards = [
    {
      href: `/${chronicle}/items`,
      title: "Items",
      description: "Weapons, armor, and etcetera items",
      count: itemCount,
    },
    {
      href: `/${chronicle}/npcs`,
      title: "NPCs",
      description: "Every NPC in the dataset — merchants, folk, monsters",
      count: npcCount,
    },
    {
      href: `/${chronicle}/monsters`,
      title: "Monsters",
      description: "Filtered view over NPCs: monsters, raid/grand bosses, chests",
      count: monsterCount,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          chronicle
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          {chronicle}
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Browse items, NPCs, and drop tables from the {chronicle} dataset.
          All data is served live from the{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 font-mono text-xs dark:bg-zinc-800">
            /api/{chronicle}
          </code>{" "}
          endpoints.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col gap-2 rounded border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {card.title}
              </h2>
              {card.count !== null && (
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {card.count.toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {card.description}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}

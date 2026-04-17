import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import { ItemSourceTable } from "@/components/explorer/ItemSourceTable";
import type { ItemDetailDto } from "@/lib/api/dto/item";
import type { ItemSourceEntry } from "@/lib/data/indexes";

interface SourceResponse {
  sources: ItemSourceEntry[];
  meta: { itemId: number; total: number };
}

export default async function ItemDetailsPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [itemResult, droppedByResult, spoiledByResult] = await Promise.all([
    apiFetch<ItemDetailDto>(`/api/${chronicle}/items/${numericId}`),
    apiFetch<SourceResponse>(
      `/api/${chronicle}/items/${numericId}/dropped-by`
    ),
    apiFetch<SourceResponse>(
      `/api/${chronicle}/items/${numericId}/spoiled-by`
    ),
  ]);

  if (!itemResult.ok) {
    if (itemResult.status === 404) notFound();
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {(itemResult as { error?: string }).error ?? "Failed to load item"}
      </div>
    );
  }

  const item = itemResult.data;
  const droppedBy = droppedByResult.ok ? droppedByResult.data.sources : [];
  const spoiledBy = spoiledByResult.ok ? spoiledByResult.data.sources : [];

  const basics = nonNull([
    stat("Weight", item.weight),
    stat("Price", item.price),
    stat("Material", item.material),
    stat("Body Slot", item.bodypart),
  ]);

  const combat = nonNull([
    stat("P. Attack", item.pAtk),
    stat("M. Attack", item.mAtk),
    stat("P. Defense", item.pDef),
    stat("M. Defense", item.mDef),
    stat("Crit Rate", item.rCrit),
    stat("Atk. Speed", item.pAtkSpd),
    stat("Shield Rate", item.rShld),
    stat("Shield Def.", item.sDef),
    stat("Accuracy", item.accCombat),
    stat("Evasion", item.rEvas),
    stat("Soulshots", item.soulshots),
    stat("Spiritshots", item.spiritshots),
    stat("MP Consume", item.mpConsume),
    stat("Reuse Delay", item.reuseDelay),
  ]);

  const info = nonNull([
    stat("Weapon Type", item.weaponType),
    stat("Armor Type", item.armorType),
    stat("Item Category", item.etcItemType),
    stat("Crystal Count", item.crystalCount),
  ]);

  const trade = nonNull([
    stat("Stackable", item.isStackable),
    stat("Tradable", item.isTradable),
    stat("Dropable", item.isDropable),
    stat("Sellable", item.isSellable),
  ]);

  const typeBadge =
    item.type === "weapon"
      ? "Weapon"
      : item.type === "armor"
        ? "Armor"
        : "Item";

  const gradeLabel = item.grade === "none" ? null : item.grade.toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/items`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All items
      </Link>

      <header className="flex items-center gap-4">
        <ItemIcon iconFile={item.iconFile} name={item.name} size={32} />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
              {typeBadge}
            </span>
            {gradeLabel && (
              <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                Grade {gradeLabel}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {item.name}
          </h1>
        </div>
      </header>

      {basics.length > 0 && (
        <Section title="Basics">
          <StatGrid stats={basics} />
        </Section>
      )}

      {combat.length > 0 && (
        <Section title="Combat">
          <StatGrid stats={combat} />
        </Section>
      )}

      {info.length > 0 && (
        <Section title="Item Info">
          <StatGrid stats={info} />
        </Section>
      )}

      {trade.length > 0 && (
        <Section title="Trade">
          <StatGrid stats={trade} />
        </Section>
      )}

      <Section title={`Dropped by (${droppedBy.length})`}>
        <ItemSourceTable
          chronicle={chronicle}
          sources={droppedBy}
          emptyMessage="No NPCs drop this item."
        />
      </Section>

      {spoiledBy.length > 0 && (
        <Section title={`Spoiled by (${spoiledBy.length})`}>
          <ItemSourceTable
            chronicle={chronicle}
            sources={spoiledBy}
            emptyMessage="No NPCs spoil this item."
          />
        </Section>
      )}
    </div>
  );
}

type StatEntry = { label: string; display: string };

function stat(
  label: string,
  value: string | number | boolean | null | undefined
): StatEntry | null {
  if (value == null) return null;
  if (typeof value === "boolean") return { label, display: value ? "Yes" : "No" };
  if (typeof value === "number") return { label, display: value.toLocaleString() };
  if (typeof value === "string" && value === "") return null;
  return { label, display: String(value) };
}

function nonNull(entries: (StatEntry | null)[]): StatEntry[] {
  return entries.filter((e): e is StatEntry => e !== null);
}

function StatGrid({ stats }: { stats: StatEntry[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs sm:grid-cols-3 md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label}>
          <dt className="text-zinc-500 dark:text-zinc-400">{s.label}</dt>
          <dd className="text-zinc-900 dark:text-zinc-100">{s.display}</dd>
        </div>
      ))}
    </dl>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

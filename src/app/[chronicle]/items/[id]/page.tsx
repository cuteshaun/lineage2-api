import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { FieldList } from "@/components/explorer/FieldList";
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

  const identity = [
    { label: "ID", value: item.id },
    { label: "Name", value: item.name },
    { label: "Type", value: item.type },
    { label: "Grade", value: item.grade },
    { label: "Material", value: item.material },
    { label: "Weight", value: item.weight },
    { label: "Price", value: item.price },
  ];

  const combat = [
    { label: "pAtk", value: item.pAtk },
    { label: "mAtk", value: item.mAtk },
    { label: "pDef", value: item.pDef },
    { label: "mDef", value: item.mDef },
    { label: "rCrit", value: item.rCrit },
    { label: "pAtkSpd", value: item.pAtkSpd },
    { label: "rShld", value: item.rShld },
    { label: "sDef", value: item.sDef },
    { label: "accCombat", value: item.accCombat },
    { label: "rEvas", value: item.rEvas },
  ];

  const equipment = [
    { label: "weaponType", value: item.weaponType },
    { label: "armorType", value: item.armorType },
    { label: "etcItemType", value: item.etcItemType },
    { label: "bodypart", value: item.bodypart },
    { label: "isMagical", value: item.isMagical },
    { label: "crystalCount", value: item.crystalCount },
    { label: "itemSkill", value: item.itemSkill },
  ];

  const flags = [
    { label: "isStackable", value: item.isStackable },
    { label: "isTradable", value: item.isTradable },
    { label: "isDropable", value: item.isDropable },
    { label: "isSellable", value: item.isSellable },
    { label: "soulshots", value: item.soulshots },
    { label: "spiritshots", value: item.spiritshots },
    { label: "mpConsume", value: item.mpConsume },
    { label: "reuseDelay", value: item.reuseDelay },
  ];

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
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            item · #{item.id}
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            {item.name}
          </h1>
        </div>
      </header>

      <Section title="Identity">
        <FieldList fields={identity} />
      </Section>

      {combat.some((f) => f.value !== null) && (
        <Section title="Combat stats">
          <FieldList fields={combat} />
        </Section>
      )}

      <Section title="Equipment">
        <FieldList fields={equipment} />
      </Section>

      <Section title="Flags & misc">
        <FieldList fields={flags} />
      </Section>

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

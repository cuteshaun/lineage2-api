import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import { ExchangeCard } from "@/components/explorer/ExchangeCard";
import type { ShopResponseDto } from "@/lib/api/dto/shop";

export default async function NpcShopPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const result = await apiFetch<ShopResponseDto>(
    `/api/${chronicle}/npcs/${numericId}/shop`
  );
  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {(result as { error?: string }).error ?? "Failed to load shop"}
      </div>
    );
  }

  const { npc, buyList = [], exchanges = [] } = result.data;
  const hasShop = buyList.length > 0 || exchanges.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/npcs/${npc.id}`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to {npc.name}
      </Link>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          shop · #{npc.id}
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          {npc.name}
        </h1>
      </header>

      {!hasShop && (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          This NPC has no shop data on file.
        </div>
      )}

      {buyList.length > 0 && (
        <Section
          title={
            buyList.length === 1
              ? "Buy List"
              : `Buy List (${buyList.length})`
          }
        >
          <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left font-mono text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Item</th>
                  <th className="w-32 px-3 py-2 text-right">Price</th>
                  <th className="w-20 px-3 py-2 text-right">List</th>
                </tr>
              </thead>
              <tbody>
                {buyList.map((p) => (
                  <tr
                    key={`${p.itemId}-${p.buyListId}`}
                    className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/${chronicle}/items/${p.itemId}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <ItemIcon
                          iconFile={p.iconFile}
                          name={p.name}
                          size={20}
                          decorative
                        />
                        <span className="text-zinc-900 dark:text-zinc-100">
                          {p.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {p.price.toLocaleString()} a
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                      #{p.buyListId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {exchanges.length > 0 && (
        <Section
          title={
            exchanges.length === 1
              ? "Exchanges"
              : `Exchanges (${exchanges.length})`
          }
        >
          <div className="flex flex-col gap-3">
            {exchanges.map((ex, i) => (
              <ExchangeCard
                key={`shop-${ex.multisellId}-${i}`}
                chronicle={chronicle}
                exchange={ex}
              />
            ))}
          </div>
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

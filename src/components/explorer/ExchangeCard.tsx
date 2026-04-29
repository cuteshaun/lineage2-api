import Link from "next/link";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import type { ExchangeOptionDto, ItemQuantityDto, NpcRefDto } from "@/lib/api/dto/item";

/**
 * Compact card for one multisell exchange entry. Layout:
 *   header  — NPC line (single name when one, "Offered by N NPCs" + list when many) + optional "maintains enchant" badge
 *   required — list of consumed items (icon + name + ×count)
 *   produces — single produced item
 *
 * `currentItemId` is the page's current item id. Whichever side it sits
 * on (required[] or produces) is amber-highlighted with a "(this item)"
 * marker — same convention as `ArmorSetCard`. Other items are clickable
 * links to `/items/<itemId>`.
 */
export function ExchangeCard({
  chronicle,
  exchange,
  currentItemId,
}: {
  chronicle: string;
  exchange: ExchangeOptionDto;
  currentItemId?: number;
}) {
  return (
    <div className="flex flex-col gap-2 rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <NpcsHeader chronicle={chronicle} npcs={exchange.npcs} />
        {exchange.maintainEnchantment && (
          <span className="font-mono text-[10px] uppercase tracking-wide text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
            ✓ Maintains enchant
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Required
        </span>
        <div className="flex flex-col gap-1">
          {exchange.required.map((item) => (
            <ItemRow
              key={item.itemId}
              chronicle={chronicle}
              item={item}
              isCurrent={item.itemId === currentItemId}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Produces
        </span>
        <ItemRow
          chronicle={chronicle}
          item={exchange.produces}
          isCurrent={exchange.produces.itemId === currentItemId}
        />
      </div>
    </div>
  );
}

function ItemRow({
  chronicle,
  item,
  isCurrent,
}: {
  chronicle: string;
  item: ItemQuantityDto;
  isCurrent: boolean;
}) {
  const inner = (
    <>
      <ItemIcon
        iconFile={item.iconFile}
        name={item.name}
        size={20}
        decorative
      />
      <span className="min-w-0 flex-1 truncate">
        <span
          className={
            isCurrent
              ? "font-semibold text-amber-700 dark:text-amber-400"
              : "text-zinc-900 dark:text-zinc-100"
          }
        >
          {item.name}
        </span>
        <span className="text-zinc-500 dark:text-zinc-400">
          {" "}
          × {item.count.toLocaleString()}
        </span>
        {isCurrent && (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400">
            (this item)
          </span>
        )}
      </span>
    </>
  );

  if (isCurrent) {
    return <div className="flex items-center gap-2 text-sm">{inner}</div>;
  }

  return (
    <Link
      href={`/${chronicle}/items/${item.itemId}`}
      className="flex items-center gap-2 text-sm hover:underline"
    >
      {inner}
    </Link>
  );
}

/**
 * Renders the NPC line of an exchange. When the multisell carries
 * exactly one NPC (e.g. Mammon), shows that NPC's linked name. When
 * multiple NPCs share the multisell (e.g. B-grade unseal lists 14 town
 * blacksmiths), shows a count summary plus a compact comma-separated
 * list of links so the player can jump to any of them.
 */
function NpcsHeader({
  chronicle,
  npcs,
}: {
  chronicle: string;
  npcs: NpcRefDto[];
}) {
  if (npcs.length === 0) {
    return <span className="text-zinc-500 dark:text-zinc-400">NPC: —</span>;
  }
  if (npcs.length === 1) {
    const npc = npcs[0];
    return (
      <span className="text-zinc-500 dark:text-zinc-400">
        NPC:{" "}
        <Link
          href={`/${chronicle}/npcs/${npc.id}`}
          className="font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
        >
          {npc.name}
        </Link>
      </span>
    );
  }
  return (
    <span className="min-w-0 flex-1 text-zinc-500 dark:text-zinc-400">
      <span>
        Offered by{" "}
        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
          {npcs.length} NPCs
        </span>
      </span>{" "}
      <span className="text-zinc-600 dark:text-zinc-400">
        {npcs.map((npc, i) => (
          <span key={npc.id}>
            {i > 0 && ", "}
            <Link
              href={`/${chronicle}/npcs/${npc.id}`}
              className="hover:underline"
            >
              {npc.name}
            </Link>
          </span>
        ))}
      </span>
    </span>
  );
}

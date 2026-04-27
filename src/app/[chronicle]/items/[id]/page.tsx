import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch, apiFetchList } from "@/lib/api/client";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import { ArmorSetCard } from "@/components/explorer/ArmorSetCard";
import { PaginatedItemSourceTable } from "@/components/explorer/PaginatedItemSourceTable";
import type { ItemDetailDto } from "@/lib/api/dto/item";
import type { ItemSourceEntryDto } from "@/lib/api/dto/drops";
import type { SkillEffect } from "@/lib/types";

const SA_STAT_LABELS: Record<string, string> = {
  pAtk: "P. Atk.",
  mAtk: "M. Atk.",
  pDef: "P. Def.",
  mDef: "M. Def.",
  pAtkSpd: "Atk. Spd.",
  mAtkSpd: "Casting Spd.",
  cAtkAdd: "Crit Damage",
  absorbDam: "HP Drain",
  maxHp: "Max HP",
  maxMp: "Max MP",
  maxCp: "Max CP",
  rCrit: "Crit Rate",
  rEvas: "Evasion",
  accCombat: "Accuracy",
  regHp: "HP Regen",
  regMp: "MP Regen",
  atkCountMax: "Attack Count",
  sDef: "Shield Def.",
  reflectDam: "Reflect Dmg.",
};

const SA_HIDDEN_STATS = new Set([
  "pvpPhysDmg",
  "pvpPhysSkillsDmg",
  "pvpMagicalDmg",
]);

function formatSaEffect(e: SkillEffect): string | null {
  if (SA_HIDDEN_STATS.has(e.stat)) return null;
  const label = SA_STAT_LABELS[e.stat];
  if (!label) return null;
  if (e.op === "mul") {
    const pct = Math.round((e.value - 1) * 100);
    if (pct === 0) return null;
    return `${pct > 0 ? "+" : ""}${pct}% ${label}`;
  }
  if (e.value === 0) return null;
  return `${e.value > 0 ? "+" : ""}${e.value} ${label}`;
}

const PVP_STATS = ["pvpPhysDmg", "pvpPhysSkillsDmg", "pvpMagicalDmg"] as const;

function effectKey(e: SkillEffect): string {
  return `${e.stat}|${e.op}|${e.value}`;
}

function dedupEffects(effects: SkillEffect[]): SkillEffect[] {
  const seen = new Map<string, SkillEffect>();
  for (const e of effects) {
    const k = effectKey(e);
    if (!seen.has(k)) seen.set(k, e);
  }
  return [...seen.values()];
}

function computeSharedEffects(variantEffects: SkillEffect[][]): SkillEffect[] {
  if (variantEffects.length <= 1) return [];
  const [first, ...rest] = variantEffects;
  return first.filter((e) => {
    const k = effectKey(e);
    return rest.every((set) => set.some((x) => effectKey(x) === k));
  });
}

function formatSharedEffects(shared: SkillEffect[]): string[] {
  // PvP damage is surfaced via `item.pvpBonus` (engine-rule field at the
  // DTO layer). Here we only format non-PvP shared stats like polearm
  // atkCountMax. The per-variant `SA_HIDDEN_STATS` filter still hides PvP
  // entries in individual SA lines.
  const out: string[] = [];
  for (const e of shared) {
    if (PVP_STATS.includes(e.stat as (typeof PVP_STATS)[number])) continue;
    const label = SA_STAT_LABELS[e.stat];
    if (!label) continue;
    if (e.op === "mul") {
      const pct = Math.round((e.value - 1) * 100);
      if (pct === 0) continue;
      out.push(`${pct > 0 ? "+" : ""}${pct}% ${label}`);
    } else {
      if (e.value === 0) continue;
      out.push(`${e.value > 0 ? "+" : ""}${e.value} ${label}`);
    }
  }
  return Array.from(new Set(out));
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

  const PAGE_SIZE = 25;

  const [itemResult, droppedByResult, spoiledByResult] = await Promise.all([
    apiFetch<ItemDetailDto>(`/api/${chronicle}/items/${numericId}`),
    apiFetchList<ItemSourceEntryDto>(
      `/api/${chronicle}/items/${numericId}/dropped-by?limit=${PAGE_SIZE}`
    ),
    apiFetchList<ItemSourceEntryDto>(
      `/api/${chronicle}/items/${numericId}/spoiled-by?limit=${PAGE_SIZE}`
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
  const droppedBy = droppedByResult.ok ? droppedByResult.data : [];
  const droppedByTotal = droppedByResult.ok ? droppedByResult.meta.total : 0;
  const spoiledBy = spoiledByResult.ok ? spoiledByResult.data : [];
  const spoiledByTotal = spoiledByResult.ok ? spoiledByResult.meta.total : 0;

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
    stat(
      "Skill",
      item.skill?.name?.replace("Special Ability: ", "SA: ") ?? null
    ),
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

      {item.crafting && (
        <Section title="Crafting">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Product
              </span>
              <Link
                href={`/${chronicle}/items/${item.crafting.productItemId}`}
                className="flex items-center gap-3 rounded border border-zinc-100 p-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
              >
                <ItemIcon
                  iconFile={item.crafting.productIconFile}
                  name={item.crafting.productName}
                  size={28}
                />
                <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                  {item.crafting.productName}
                  {item.crafting.productCount > 1 && (
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {" "}
                      ×{item.crafting.productCount}
                    </span>
                  )}
                </span>
              </Link>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Ingredients
              </span>
              {item.crafting.ingredients.map((ing) => (
                <Link
                  key={ing.itemId}
                  href={`/${chronicle}/items/${ing.itemId}`}
                  className="flex items-center gap-3 rounded border border-zinc-100 p-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
                >
                  <ItemIcon
                    iconFile={ing.iconFile}
                    name={ing.name}
                    size={28}
                  />
                  <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                    {ing.name}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {" "}
                      ×{ing.count}
                    </span>
                  </span>
                </Link>
              ))}
            </div>

            <StatGrid
              stats={nonNull([
                stat("Success Rate", `${item.crafting.successRate}%`),
                stat("Craft Level", item.crafting.level),
                stat("MP Cost", item.crafting.mpConsume),
                stat("Dwarven", item.crafting.isDwarven),
              ])}
            />
          </div>
        </Section>
      )}

      {item.craftedBy && item.craftedBy.length > 0 && (
        <Section title="Crafted By">
          <div className="flex flex-col gap-2">
            {item.craftedBy.map((r) => (
              <Link
                key={r.recipeItemId}
                href={`/${chronicle}/items/${r.recipeItemId}`}
                className="flex items-center justify-between rounded border border-zinc-100 p-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
              >
                <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100">
                  {r.recipeName}
                </span>
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {r.successRate}%
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {item.baseWeaponId != null && (
        <Section title="Base weapon">
          <Link
            href={`/${chronicle}/items/${item.baseWeaponId}`}
            className="inline-flex items-center gap-2 font-mono text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-200"
          >
            ← View base weapon
          </Link>
        </Section>
      )}

      {item.partOfSets && item.partOfSets.length > 0 && (
        <Section
          title={
            item.partOfSets.length === 1
              ? "Part of Set"
              : `Part of Sets (${item.partOfSets.length})`
          }
        >
          <div className="flex flex-col gap-3">
            {item.partOfSets.map((set) => (
              <ArmorSetCard
                key={set.id}
                chronicle={chronicle}
                set={set}
                currentItemId={item.id}
              />
            ))}
          </div>
        </Section>
      )}

      {item.specialAbilityOptions && item.specialAbilityOptions.length > 0 && (
        <Section
          title={'Special Ability'}
        >
          {(() => {
            const variantEffects = item.specialAbilityOptions.map((sa) =>
              dedupEffects(sa.skills.flatMap((s) => s.effects ?? []))
            );
            const sharedEffects = computeSharedEffects(variantEffects);
            const sharedKeys = new Set(sharedEffects.map(effectKey));
            const sharedLabels = [
              ...(item.pvpBonus ? [item.pvpBonus.display] : []),
              ...formatSharedEffects(sharedEffects),
            ];
            return (
          <div className="flex flex-col gap-3">
            {sharedLabels.length > 0 && (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                Shared Bonus: {sharedLabels.join(", ")}
              </span>
            )}
            {item.specialAbilityOptions.map((sa, idx) => {
              const descriptions = Array.from(
                new Set(
                  sa.skills
                    .map((s) => s.description)
                    .filter((d): d is string => !!d)
                )
              );
              const effectSummary = Array.from(
                new Set([
                  ...variantEffects[idx]
                    .filter((e) => !sharedKeys.has(effectKey(e)))
                    .map(formatSaEffect)
                    .filter((s): s is string => !!s),
                  ...(sa.statDelta ? [sa.statDelta.display] : []),
                ])
              );
              return (
                <Link
                  key={sa.itemId}
                  href={`/${chronicle}/items/${sa.itemId}`}
                  className="flex items-start gap-4 rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  <ItemIcon
                    iconFile={sa.iconFile}
                    name={sa.saName}
                    size={44}
                    decorative
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {sa.saName}
                    </span>
                    {sa.effectChance != null && (
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Chance: {sa.effectChance}%
                      </span>
                    )}
                    {descriptions.map((d, i) => (
                      <span
                        key={i}
                        className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400"
                      >
                        {d}
                      </span>
                    ))}
                    {effectSummary.length > 0 && (
                      <span className="text-sm">
                        {effectSummary.map((s, i) => (
                          <span key={i}>
                            {i > 0 && (
                              <span className="text-zinc-400 dark:text-zinc-500">{", "}</span>
                            )}
                            <span
                              className={
                                s.startsWith("+")
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : s.startsWith("-")
                                    ? "text-red-500 dark:text-red-400"
                                    : "text-zinc-700 dark:text-zinc-300"
                              }
                            >
                              {s}
                            </span>
                          </span>
                        ))}
                      </span>
                    )}
                    {sa.saveMechanic && (
                      <span className="text-sm text-emerald-600 dark:text-emerald-400">
                        {sa.saveMechanic.chance}% chance to save{" "}
                        {sa.saveMechanic.amount}{" "}
                        {sa.saveMechanic.kind === "soulshot"
                          ? sa.saveMechanic.amount === 1
                            ? "soulshot"
                            : "soulshots"
                          : "MP"}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
            );
          })()}
        </Section>
      )}

      <Section title={`Dropped by (${droppedByTotal})`}>
        <PaginatedItemSourceTable
          chronicle={chronicle}
          initialSources={droppedBy}
          total={droppedByTotal}
          limit={PAGE_SIZE}
          fetchUrl={`/api/${chronicle}/items/${numericId}/dropped-by`}
          emptyMessage="No NPCs drop this item."
        />
      </Section>

      {spoiledByTotal > 0 && (
        <Section title={`Spoiled by (${spoiledByTotal})`}>
          <PaginatedItemSourceTable
            chronicle={chronicle}
            initialSources={spoiledBy}
            total={spoiledByTotal}
            limit={PAGE_SIZE}
            fetchUrl={`/api/${chronicle}/items/${numericId}/spoiled-by`}
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

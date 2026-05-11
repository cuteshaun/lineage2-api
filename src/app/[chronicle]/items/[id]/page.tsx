import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch, apiFetchList } from "@/lib/api/client";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import { ArmorSetCard } from "@/components/explorer/ArmorSetCard";
import { ExchangeCard } from "@/components/explorer/ExchangeCard";
import { PaginatedItemSourceTable } from "@/components/explorer/PaginatedItemSourceTable";
import type { ItemDetailDto } from "@/lib/api/dto/item";
import type { ItemSourceEntryDto } from "@/lib/api/dto/drops";
import type { HennaDetailDto, HennaStatChangesDto } from "@/lib/api/dto/henna";
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

  // Second-stage fetch only for dye items: HennaDetailDto carries
  // the allowed-class count so the embedded section can render the
  // compact "Available to N classes" line. Class detail and excluded-
  // class enumeration belong on `/hennas?symbolId=…`, not here.
  const hennaDetail =
    item.henna != null
      ? await apiFetch<HennaDetailDto>(
          `/api/${chronicle}/hennas/${item.henna.symbolId}`
        )
      : null;
  const hennaAllowedCount =
    hennaDetail && hennaDetail.ok ? hennaDetail.data.allowedClasses.length : null;

  const basics = nonNull([
    stat("Weight", item.weight),
    stat("Price", item.price),
    stat("Material", item.material),
    stat("Body Slot", item.category?.bodypart ?? null),
  ]);

  const combat = nonNull([
    stat("P. Attack", item.stats?.pAtk ?? null),
    stat("M. Attack", item.stats?.mAtk ?? null),
    stat("P. Defense", item.stats?.pDef ?? null),
    stat("M. Defense", item.stats?.mDef ?? null),
    stat("Crit Rate", item.stats?.rCrit ?? null),
    stat("Atk. Speed", item.stats?.pAtkSpd ?? null),
    stat("Shield Rate", item.stats?.rShld ?? null),
    stat("Shield Def.", item.stats?.sDef ?? null),
    stat("Accuracy", item.stats?.accCombat ?? null),
    stat("Evasion", item.stats?.rEvas ?? null),
    stat("Soulshots", item.shots?.soulshots ?? null),
    stat("Spiritshots", item.shots?.spiritshots ?? null),
    stat("MP Consume", item.shots?.mpConsume ?? null),
    stat("Reuse Delay", item.timing?.reuseDelay ?? null),
  ]);

  const info = nonNull([
    stat("Weapon Type", item.category?.weaponType ?? null),
    stat("Armor Type", item.category?.armorType ?? null),
    stat("Item Category", item.category?.etcItemType ?? null),
    stat("Crystal Count", item.crystal?.count ?? null),
    stat(
      "Skill",
      item.skill?.name?.replace("Special Ability: ", "SA: ") ?? null
    ),
  ]);

  const trade = nonNull([
    stat("Stackable", item.flags?.stackable ?? null),
    stat("Tradable", item.flags?.tradable ?? null),
    stat("Dropable", item.flags?.dropable ?? null),
    stat("Sellable", item.flags?.sellable ?? null),
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

      {item.soldBy && item.soldBy.length > 0 && (
        <Section
          title={
            item.soldBy.length === 1
              ? "Sold By"
              : `Sold By (${item.soldBy.length})`
          }
        >
          <div className="flex flex-col">
            {item.soldBy.map((offer) => (
              <Link
                key={`${offer.npc.id}-${offer.buyListId}`}
                href={`/${chronicle}/npcs/${offer.npc.id}`}
                className="flex items-center justify-between gap-3 border-t border-zinc-100 px-3 py-2 text-sm transition-colors first:border-t-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span className="text-zinc-900 dark:text-zinc-100">
                  {offer.npc.name}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {offer.price.toLocaleString()} a
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    list #{offer.buyListId}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {item.exchangeFrom && item.exchangeFrom.length > 0 && (
        <Section
          title={
            item.exchangeFrom.length === 1
              ? "Exchange From"
              : `Exchange From (${item.exchangeFrom.length})`
          }
        >
          <div className="flex flex-col gap-3">
            {item.exchangeFrom.map((ex, i) => (
              <ExchangeCard
                key={`from-${ex.multisellId}-${i}`}
                chronicle={chronicle}
                exchange={ex}
                currentItemId={item.id}
              />
            ))}
          </div>
        </Section>
      )}

      {item.exchangeFor && item.exchangeFor.length > 0 && (
        <Section
          title={
            item.exchangeFor.length === 1
              ? "Exchange For"
              : `Exchange For (${item.exchangeFor.length})`
          }
        >
          <div className="flex flex-col gap-3">
            {item.exchangeFor.map((ex, i) => (
              <ExchangeCard
                key={`for-${ex.multisellId}-${i}`}
                chronicle={chronicle}
                exchange={ex}
                currentItemId={item.id}
              />
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

      {item.henna && (
        <Section
          title={
            item.henna.displayName != null
              ? "Henna"
              : "Henna (engine record)"
          }
        >
          <HennaBlock
            chronicle={chronicle}
            henna={item.henna}
            allowedCount={hennaAllowedCount}
          />
        </Section>
      )}

      {item.rewardedByQuests && item.rewardedByQuests.length > 0 && (
        <Section
          title={
            item.rewardedByQuests.length === 1
              ? "Rewarded by quest"
              : `Rewarded by quests (${item.rewardedByQuests.length})`
          }
        >
          <ul className="flex flex-col gap-1.5 text-sm">
            {item.rewardedByQuests.map(({ quest, count }) => {
              // Adena (item 57): `count` is the per-quest
              // `q.rewards.adena` scalar — render as an Adena amount.
              // Other items: `count` is `q.rewards.items[].count` —
              // render as `×N`.
              const countLabel =
                item.id === 57
                  ? `${count.toLocaleString()} a`
                  : `×${count.toLocaleString()}`;
              return (
                <li key={quest.id}>
                  <Link
                    href={`/${chronicle}/quests/${quest.id}`}
                    className="flex items-baseline justify-between gap-3 hover:underline"
                  >
                    <span className="text-zinc-900 dark:text-zinc-100">
                      {quest.name}
                    </span>
                    <span className="flex items-baseline gap-3 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {countLabel}
                      </span>
                      <span>
                        {quest.levelMin != null ? `Lv ${quest.levelMin}` : "—"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {item.questItemFor && item.questItemFor.length > 0 && (
        <Section
          title={
            item.questItemFor.length === 1
              ? "Quest Item For"
              : `Quest Item For (${item.questItemFor.length})`
          }
        >
          <ul className="flex flex-col gap-1.5 text-sm">
            {item.questItemFor.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/${chronicle}/quests/${q.id}`}
                  className="flex items-baseline justify-between gap-3 hover:underline"
                >
                  <span className="text-zinc-900 dark:text-zinc-100">
                    {q.name}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                    {q.levelMin != null ? `Lv ${q.levelMin}` : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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

/**
 * Henna section body for item detail. Honest about nullable display
 * fields (Greater II tier symbols carry mechanics only).
 *
 * Class applicability has three branches, picked by allow-list size:
 *
 *   1. `allowedClasses.length <= SHOW_ALL_THRESHOLD` (12): list every
 *      allowed class as a tag. Compact and complete.
 *   2. Broad allow-list AND the *excluded* set (= every chronicle
 *      class minus the allow-list) is shorter than the allow-list:
 *      flip the framing to *"Available to N classes / Except: …"*
 *      so the noise scales with whichever side is smaller. The full
 *      class list is fetched once on the server side at the top of
 *      this page — see `apiFetchList<ClassListDto>` above.
 *   3. Otherwise: compact preview of the first `PREVIEW_LIMIT` (8)
 *      allowed classes plus a `+N more` chip.
 */
function HennaBlock({
  chronicle,
  henna,
  allowedCount,
}: {
  chronicle: string;
  henna: NonNullable<ItemDetailDto["henna"]>;
  allowedCount: number | null;
}) {
  const displayName = henna.displayName ?? `Symbol #${henna.symbolId}`;
  // Henna symbol icon falls back to the dye item icon (different art —
  // `etc_str_symbol_*` vs `etc_str_hena_*`) only when the DAT didn't
  // supply a symbol slug. Keeps the section visually anchored without
  // fabricating data.
  const iconFile = henna.iconFile ?? henna.dyeItem.iconFile;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <ItemIcon iconFile={iconFile} name={displayName} size={36} decorative />
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {displayName}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              symbol #{henna.symbolId}
            </span>
          </div>
          {henna.shortLabel && (
            <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {henna.shortLabel}
            </span>
          )}
        </div>
      </div>

      {henna.displayName == null && (
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Display fields unavailable from the L2 client DAT for this symbol;
          mechanics shown below.
        </p>
      )}

      <StatChangeBadges changes={henna.statChanges} />

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-xs">
        <div>
          <span className="text-zinc-400 dark:text-zinc-500">Engrave price · </span>
          <span className="text-zinc-900 dark:text-zinc-100">
            {henna.engravePrice.toLocaleString()} a
          </span>
        </div>
        <div>
          <span className="text-zinc-400 dark:text-zinc-500">Dye item · </span>
          <Link
            href={`/${chronicle}/items/${henna.dyeItem.id}`}
            className="text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {henna.dyeItem.name}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs">
        <p className="text-zinc-700 dark:text-zinc-300">
          <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Class availability ·{" "}
          </span>
          Restricted by class / profession
          {allowedCount != null && (
            <>
              {" "}
              <span className="text-zinc-500 dark:text-zinc-400">
                ({allowedCount.toLocaleString()} class
                {allowedCount === 1 ? "" : "es"})
              </span>
            </>
          )}
        </p>
        <Link
          href={`/${chronicle}/hennas?symbolId=${henna.symbolId}`}
          className="self-start font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400"
        >
          View eligible classes →
        </Link>
      </div>
    </div>
  );
}

/**
 * Renders a compact row of `+/- N STAT` badges. Positive values
 * render in emerald, negative in red — consistent with the SA
 * effect coloring rule above. Does not synthesize labels for
 * missing keys; the source data carries exactly two non-zero
 * deltas per symbol in current Interlude content.
 */
function StatChangeBadges({ changes }: { changes: HennaStatChangesDto }) {
  const ORDER: Array<keyof HennaStatChangesDto> = [
    "STR",
    "CON",
    "DEX",
    "INT",
    "MEN",
    "WIT",
  ];
  const entries = ORDER.flatMap((stat) => {
    const v = changes[stat];
    return v == null ? [] : [{ stat, value: v }];
  });
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5 font-mono text-xs">
      {entries.map(({ stat, value }) => {
        const sign = value > 0 ? "+" : "";
        const colorClass =
          value > 0
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
        return (
          <li
            key={stat}
            className={`rounded border px-2 py-0.5 ${colorClass}`}
          >
            {stat} {sign}
            {value}
          </li>
        );
      })}
    </ul>
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

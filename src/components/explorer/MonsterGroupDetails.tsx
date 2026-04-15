import Link from "next/link";
import { FieldList } from "./FieldList";
import { DropsTable } from "./DropsTable";
import { type EnrichedNpcDrops } from "./NpcDetails";
import type { Chronicle } from "@/lib/chronicles";
import type { MonsterGroupDetail } from "@/lib/api/monster-groups";
import type { CanonicalMonsterView } from "@/lib/api/monsters";

/**
 * Detail view for `/monsters/[id]`. Consumes the public monster GROUP
 * response (`MonsterGroupDetail`) — one entry per exact monster name with
 * a list of canonical variants nested inside.
 *
 * Presentation:
 *   - Group identity header (id, name, variant count) + Source block.
 *   - One SELECTED variant rendered as the main monster detail card,
 *     with a compact inline header followed by Vitals / Combat / Base
 *     stats / AI / Skills / Drops / Same template entries sections.
 *     The legacy "Identity" panel is intentionally absent — title, type,
 *     level, and the variant id are folded into the compact header
 *     instead, to avoid double-displaying ids the page header already
 *     shows.
 *   - Below: a compact "Variants" picker. Each entry is a `<Link>` to
 *     `?variant=<canonicalId>`. Clicking switches the main card.
 *
 * Variant selection is URL-driven via the `variant` query param. The page
 * stays a server component; switching variants is a Next.js soft
 * navigation. The default selection is the first variant in the array
 * (which the backend already sorts by canonicalId ascending).
 *
 * Drops are fetched at the page level for the resolved selected variant
 * via the existing `/api/[chronicle]/npcs/[id]/drops` endpoint and passed
 * down as the `drops` prop. They are NOT embedded in the grouped detail
 * response — embedding them would inflate payloads for groups with many
 * variants while only one is rendered at a time.
 *
 * `otherVariants` is intentionally not rendered — variants are now
 * siblings under one group and visible together via the picker.
 *
 * Same-template-entries chips are static badges (not links). They are
 * informational labels showing which raw IDs fold into this template.
 */
export function MonsterGroupDetails({
  chronicle,
  group,
  selectedVariantId,
  drops,
}: {
  chronicle: Chronicle;
  group: MonsterGroupDetail;
  /** Canonical id of the variant to show in the main card. */
  selectedVariantId: number | null;
  /** Drops for the currently resolved selected variant, or null if none / fetch failed. */
  drops: EnrichedNpcDrops | null;
}) {
  // Resolve the active variant. Forgiving: an unknown / missing
  // selectedVariantId falls back to the first variant.
  const selectedVariant: CanonicalMonsterView | undefined =
    (selectedVariantId !== null
      ? group.variants.find((v) => v.canonicalId === selectedVariantId)
      : undefined) ?? group.variants[0];

  const selectedIndex = selectedVariant
    ? group.variants.indexOf(selectedVariant)
    : -1;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          monster · #{group.id}
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          {group.name}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {group.variantsCount}{" "}
          {group.variantsCount === 1 ? "variant" : "variants"}
        </p>
      </header>

      <Section title="Source">
        <FieldList
          fields={[
            { label: "project", value: group.source.project },
            { label: "chronicle", value: group.source.chronicle },
          ]}
        />
      </Section>

      {selectedVariant ? (
        <VariantMainCard
          chronicle={chronicle}
          variant={selectedVariant}
          variantIndex={selectedIndex + 1}
          variantsCount={group.variants.length}
          drops={drops}
        />
      ) : (
        <Section title="Variant detail">
          <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            No variants in this group.
          </div>
        </Section>
      )}

      {/* Only render the picker when there's more than one variant. A
          single-variant group has nothing to pick — the main card already
          shows that variant in full. */}
      {group.variants.length > 1 && (
        <Section title={`Variants (${group.variantsCount})`}>
          <VariantPicker
            chronicle={chronicle}
            groupId={group.id}
            variants={group.variants}
            selectedCanonicalId={selectedVariant?.canonicalId ?? null}
          />
        </Section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main variant card — old single-monster detail layout (no Identity panel)  */
/* -------------------------------------------------------------------------- */

function VariantMainCard({
  chronicle,
  variant,
  variantIndex,
  variantsCount,
  drops,
}: {
  chronicle: Chronicle;
  variant: CanonicalMonsterView;
  variantIndex: number;
  variantsCount: number;
  drops: EnrichedNpcDrops | null;
}) {
  const vitals = [
    { label: "HP", value: variant.hp },
    { label: "MP", value: variant.mp },
    { label: "hpRegen", value: variant.hpRegen },
    { label: "mpRegen", value: variant.mpRegen },
    { label: "exp", value: variant.exp },
    { label: "sp", value: variant.sp },
  ];

  const combat = [
    { label: "pAtk", value: variant.pAtk },
    { label: "pDef", value: variant.pDef },
    { label: "mAtk", value: variant.mAtk },
    { label: "mDef", value: variant.mDef },
    { label: "crit", value: variant.crit },
    { label: "atkSpd", value: variant.atkSpd },
  ];

  const baseStats = [
    { label: "STR", value: variant.str },
    { label: "INT", value: variant.int },
    { label: "DEX", value: variant.dex },
    { label: "WIT", value: variant.wit },
    { label: "CON", value: variant.con },
    { label: "MEN", value: variant.men },
  ];

  const ai = [
    { label: "aiType", value: variant.aiType },
    { label: "aiAggro", value: variant.aiAggro },
    { label: "aiCanMove", value: variant.aiCanMove },
    { label: "aiSeedable", value: variant.aiSeedable },
    { label: "aiSsCount", value: variant.aiSsCount },
    { label: "aiSsRate", value: variant.aiSsRate },
    { label: "aiSpsCount", value: variant.aiSpsCount },
    { label: "aiSpsRate", value: variant.aiSpsRate },
  ];

  const sameTemplate = variant.sameTemplateEntries ?? [];

  return (
    <>
      {/* Compact variant header — replaces the old Identity panel.
          Carries the variant id (for deep-link reference), level, type,
          and optional title. The label "Canonical ID" is deliberately
          gone: that's internal vocabulary, and the page-level header
          already shows the group id. */}
      <div className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          variant {variantIndex} of {variantsCount} · #{variant.canonicalId}
          {variant.level !== null && ` · level ${variant.level}`}
          {variant.npcType && ` · ${variant.npcType}`}
        </p>
        {variant.title && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {variant.title}
          </p>
        )}
      </div>

      <Section title="Vitals">
        <FieldList fields={vitals} />
      </Section>

      <Section title="Combat stats">
        <FieldList fields={combat} />
      </Section>

      <Section title="Base stats">
        <FieldList fields={baseStats} />
      </Section>

      <Section title="AI">
        <FieldList fields={ai} />
      </Section>

      {variant.skills.length > 0 && (
        <Section title={`Skills (${variant.skills.length})`}>
          <ul className="grid grid-cols-1 gap-1 font-mono text-xs text-zinc-700 sm:grid-cols-2 md:grid-cols-3 dark:text-zinc-300">
            {variant.skills.map((s) => (
              <li key={`${s.id}-${s.level}`}>
                #{s.id} · level {s.level}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Drops (${drops?.drops.length ?? 0})`}>
        <DropsTable chronicle={chronicle} drops={drops?.drops ?? []} />
      </Section>

      {/* Only render when there's more than one raw id under the canonical
          template. A single entry would just repeat the variant header's id
          and add no information. */}
      {sameTemplate.length > 1 && (
        <Section title={`Same template entries (${sameTemplate.length})`}>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Same monster template, different raw IDs.
          </p>
          <ul className="flex flex-wrap gap-2 font-mono text-xs">
            {sameTemplate.map((rawId) => {
              const isCanonical = rawId === variant.canonicalId;
              return (
                <li
                  key={rawId}
                  className={
                    isCanonical
                      ? "rounded border border-zinc-400 bg-zinc-100 px-2 py-1 text-zinc-900 dark:border-zinc-500 dark:bg-zinc-800 dark:text-zinc-100"
                      : "rounded border border-zinc-200 bg-white px-2 py-1 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                  }
                >
                  #{rawId}
                  {isCanonical ? " · canonical" : ""}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Variant picker — compact list, clicking switches the main card            */
/* -------------------------------------------------------------------------- */

function VariantPicker({
  chronicle,
  groupId,
  variants,
  selectedCanonicalId,
}: {
  chronicle: Chronicle;
  groupId: number;
  variants: CanonicalMonsterView[];
  selectedCanonicalId: number | null;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {variants.map((v) => {
        const active = v.canonicalId === selectedCanonicalId;
        return (
          <li key={v.canonicalId}>
            <Link
              href={
                // Default selection (first variant) gets a clean URL with no
                // ?variant param. Other variants get the explicit param so
                // back/forward + bookmarks behave intuitively.
                v.canonicalId === variants[0].canonicalId
                  ? `/${chronicle}/monsters/${groupId}`
                  : `/${chronicle}/monsters/${groupId}?variant=${v.canonicalId}`
              }
              aria-current={active ? "true" : undefined}
              className={
                active
                  ? "block min-w-[180px] rounded border border-zinc-900 bg-zinc-100 p-3 dark:border-zinc-300 dark:bg-zinc-800"
                  : "block min-w-[180px] rounded border border-zinc-200 bg-white p-3 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
              }
            >
              <div className="flex items-baseline justify-between font-mono text-xs">
                <span className="text-zinc-900 dark:text-zinc-100">
                  #{v.canonicalId}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {v.level !== null ? `lv ${v.level}` : "lv —"}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between font-mono text-xs text-zinc-500 dark:text-zinc-400">
                <span>{v.npcType ?? "—"}</span>
                <span>
                  {v.hp !== null
                    ? `hp ${Math.round(v.hp).toLocaleString()}`
                    : "hp —"}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section helper                                                            */
/* -------------------------------------------------------------------------- */

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

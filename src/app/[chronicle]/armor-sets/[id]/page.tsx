import Link from "next/link";
import { notFound } from "next/navigation";
import { isChronicle } from "@/lib/chronicles";
import { apiFetch } from "@/lib/api/client";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import type {
  ArmorSetDetailDto,
  ArmorSetPieceDto,
} from "@/lib/api/dto/armor-set";
import type { SkillEffect } from "@/lib/types";
import type { SkillSummaryDto } from "@/lib/api/dto/item";

const SLOT_LABELS: Record<string, string> = {
  chest: "Chest",
  legs: "Legs",
  head: "Head",
  gloves: "Gloves",
  feet: "Feet",
};

const SET_STAT_LABELS: Record<string, string> = {
  pAtk: "P. Atk.",
  mAtk: "M. Atk.",
  pDef: "P. Def.",
  mDef: "M. Def.",
  pAtkSpd: "Atk. Spd.",
  mAtkSpd: "Casting Spd.",
  cAtkAdd: "Crit Damage",
  rCrit: "Crit Rate",
  rEvas: "Evasion",
  rShld: "Shield Def. Rate",
  accCombat: "Accuracy",
  maxHp: "Max HP",
  maxMp: "Max MP",
  maxCp: "Max CP",
  regHp: "HP Regen",
  regMp: "MP Regen",
  maxLoad: "Max Load",
  runSpd: "Speed",
  STR: "STR",
  DEX: "DEX",
  CON: "CON",
  INT: "INT",
  WIT: "WIT",
  MEN: "MEN",
};

const HIDDEN_STATS = new Set([
  "pvpPhysDmg",
  "pvpPhysSkillsDmg",
  "pvpMagicalDmg",
]);

function formatEffect(e: SkillEffect): string | null {
  if (HIDDEN_STATS.has(e.stat)) return null;
  const label = SET_STAT_LABELS[e.stat];
  if (!label) return null;
  if (e.op === "mul") {
    const pct = Math.round((e.value - 1) * 100);
    if (pct === 0) return null;
    return `${pct > 0 ? "+" : ""}${pct}% ${label}`;
  }
  if (e.value === 0) return null;
  return `${e.value > 0 ? "+" : ""}${e.value} ${label}`;
}

export default async function ArmorSetDetailsPage({
  params,
}: {
  params: Promise<{ chronicle: string; id: string }>;
}) {
  const { chronicle, id } = await params;
  if (!isChronicle(chronicle)) notFound();

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const result = await apiFetch<ArmorSetDetailDto>(
    `/api/${chronicle}/armor-sets/${numericId}`
  );

  if (!result.ok) {
    if (result.status === 404) notFound();
    return (
      <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        {(result as { error?: string }).error ?? "Failed to load armor set"}
      </div>
    );
  }

  const set = result.data;

  // Render order matches typical equipment slot ordering.
  const slotOrder: Array<keyof ArmorSetDetailDto["pieces"]> = [
    "head",
    "chest",
    "legs",
    "gloves",
    "feet",
  ];
  const presentPieces: Array<{ slot: string; piece: ArmorSetPieceDto }> = [];
  for (const slot of slotOrder) {
    const piece = set.pieces[slot];
    if (piece) presentPieces.push({ slot, piece });
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/${chronicle}/armor-sets`}
        className="font-mono text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All armor sets
      </Link>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          armor set · #{set.id}
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
          {set.name}
        </h1>
      </header>

      <Section title={`Pieces (${presentPieces.length})`}>
        <div className="flex flex-col gap-2">
          {presentPieces.map(({ slot, piece }) => (
            <PieceRow
              key={slot}
              chronicle={chronicle}
              slot={SLOT_LABELS[slot] ?? slot}
              piece={piece}
            />
          ))}
        </div>
      </Section>

      <SkillSection title="Set Bonus" skill={set.bonusSkill} />

      {set.shield && (
        <Section title="Shield Bonus">
          <div className="flex flex-col gap-3">
            <PieceRow
              chronicle={chronicle}
              slot="Shield"
              piece={set.shield.piece}
            />
            {set.shield.bonusSkill && (
              <SkillCard skill={set.shield.bonusSkill} />
            )}
          </div>
        </Section>
      )}

      {set.enchant6BonusSkill && (
        <SkillSection
          title="Enchant +6 Bonus"
          skill={set.enchant6BonusSkill}
        />
      )}
    </div>
  );
}

function PieceRow({
  chronicle,
  slot,
  piece,
}: {
  chronicle: string;
  slot: string;
  piece: ArmorSetPieceDto;
}) {
  return (
    <Link
      href={`/${chronicle}/items/${piece.itemId}`}
      className="flex items-center gap-3 rounded border border-zinc-200 p-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
    >
      <ItemIcon iconFile={piece.iconFile} name={piece.name} size={36} />
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {piece.name}
        </span>
        <span className="font-mono text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {slot}
        </span>
      </div>
    </Link>
  );
}

function SkillSection({
  title,
  skill,
}: {
  title: string;
  skill: SkillSummaryDto | null;
}) {
  if (!skill) {
    return (
      <Section title={title}>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          (skill data unavailable)
        </span>
      </Section>
    );
  }
  return (
    <Section title={title}>
      <SkillCard skill={skill} />
    </Section>
  );
}

function SkillCard({ skill }: { skill: SkillSummaryDto }) {
  const formatted = (skill.effects ?? [])
    .map(formatEffect)
    .filter((s): s is string => !!s);
  const unique = Array.from(new Set(formatted));
  return (
    <div className="flex flex-col gap-1">
      <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {skill.name}
      </span>
      {skill.description && (
        <span className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {skill.description}
        </span>
      )}
      {unique.length > 0 && (
        <span className="text-sm">
          {unique.map((s, i) => (
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

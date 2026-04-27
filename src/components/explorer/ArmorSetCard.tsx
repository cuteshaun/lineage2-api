import Link from "next/link";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import type {
  ArmorSetDetailDto,
  ArmorSetPieceDto,
} from "@/lib/api/dto/armor-set";
import type { SkillSummaryDto } from "@/lib/api/dto/skill";
import type { SkillEffect } from "@/lib/types";

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

/**
 * Rich armor-set card. Used on both the standalone armor-set detail page
 * and inside an item-detail page's "Part of sets" section.
 *
 * When `currentItemId` is provided, the matching piece is visually
 * highlighted ("you are here" marker). Other pieces remain clickable
 * links to their own item pages.
 *
 * If `linkToFullSet` is true, the set name renders as a header link to
 * the full /armor-sets/[id] page; otherwise it's a plain title.
 */
export function ArmorSetCard({
  chronicle,
  set,
  currentItemId,
  linkToFullSet = false,
}: {
  chronicle: string;
  set: ArmorSetDetailDto;
  currentItemId?: number;
  linkToFullSet?: boolean;
}) {
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
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between">
        {linkToFullSet ? (
          <Link
            href={`/${chronicle}/armor-sets/${set.id}`}
            className="text-base font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
          >
            {set.name}
          </Link>
        ) : (
          <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {set.name}
          </span>
        )}
      </div>

      {set.bonusSkill && (
        <SetBonusBlock label="Set Bonus" skill={set.bonusSkill} />
      )}

      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
          Pieces ({presentPieces.length})
        </span>
        {presentPieces.map(({ slot, piece }) => (
          <PieceRow
            key={slot}
            chronicle={chronicle}
            slot={SLOT_LABELS[slot] ?? slot}
            piece={piece}
            isCurrent={piece.itemId === currentItemId}
          />
        ))}
      </div>

      {set.shield && (
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            With Shield
          </span>
          <PieceRow
            chronicle={chronicle}
            slot="Shield"
            piece={set.shield.piece}
            isCurrent={set.shield.piece.itemId === currentItemId}
          />
          {set.shield.bonusSkill && (
            <SetBonusBlock
              label="Shield Bonus"
              skill={set.shield.bonusSkill}
            />
          )}
        </div>
      )}

      {set.enchant6BonusSkill && (
        <SetBonusBlock
          label="Enchant +6 Bonus"
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
  isCurrent,
}: {
  chronicle: string;
  slot: string;
  piece: ArmorSetPieceDto;
  isCurrent: boolean;
}) {
  const inner = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <span
        className={
          isCurrent
            ? "text-sm font-semibold text-amber-700 dark:text-amber-400"
            : "text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        }
      >
        {piece.name}
        {isCurrent && (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-widest">
            (this item)
          </span>
        )}
      </span>
      <span className="font-mono text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {slot}
      </span>
    </div>
  );

  const containerClasses = isCurrent
    ? "flex items-center gap-3 rounded border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-800 dark:bg-amber-950/30"
    : "flex items-center gap-3 rounded border border-zinc-200 p-2.5 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:bg-zinc-900";

  if (isCurrent) {
    return (
      <div className={containerClasses}>
        <ItemIcon iconFile={piece.iconFile} name={piece.name} size={32} />
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/${chronicle}/items/${piece.itemId}`}
      className={containerClasses}
    >
      <ItemIcon iconFile={piece.iconFile} name={piece.name} size={32} />
      {inner}
    </Link>
  );
}

function SetBonusBlock({
  label,
  skill,
}: {
  label: string;
  skill: SkillSummaryDto;
}) {
  const formatted = (skill.effects ?? [])
    .map(formatEffect)
    .filter((s): s is string => !!s);
  const unique = Array.from(new Set(formatted));
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
        {label}
      </span>
      {skill.description && (
        <span className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
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

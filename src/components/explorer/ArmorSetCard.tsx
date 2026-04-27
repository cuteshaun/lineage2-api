import Link from "next/link";
import { ItemIcon } from "@/components/explorer/ItemIcon";
import type {
  ArmorSetDetailDto,
  ArmorSetPieceDto,
} from "@/lib/api/dto/armor-set";
import type { SkillSummaryDto } from "@/lib/api/dto/skill";
import type { SkillEffect } from "@/lib/types";

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
  // PvP multipliers — surfaced via item.pvpBonus, not per-skill.
  "pvpPhysDmg",
  "pvpPhysSkillsDmg",
  "pvpMagicalDmg",
  // Attributes — set-skill descriptions enumerate them inline
  // (e.g. "STR+2, CON-2"), and the description is the only place
  // that carries the *negative* deltas (those live in <basemul> /
  // <player>-gated XML the parser skips). Don't duplicate the
  // positives in the structured effect line.
  "STR",
  "DEX",
  "CON",
  "INT",
  "WIT",
  "MEN",
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
 * Source data names accessory pieces with a disambiguating armor-type
 * suffix when the same base name exists across heavy/light/robe sets,
 * e.g. `"Tallum Boots - Heavy Armor"`. Render as
 * `"Tallum Boots [Heavy Armor]"` — name in primary color, bracket in
 * muted color.
 */
function splitNameAndBracket(rawName: string): {
  name: string;
  bracket: string | null;
} {
  const m = rawName.match(/^(.+?) - (Heavy Armor|Light Armor|Robe)$/);
  if (m) return { name: m[1], bracket: m[2] };
  return { name: rawName, bracket: null };
}

/**
 * Compact armor-set card. Two columns:
 *   left  — set name + bonus description + numeric effects + optional enchant +6 line
 *   right — piece list (one row per piece, with disambiguating armor-type bracket)
 *
 * No internal labeled sub-headers ("Pieces (4)", "Set Bonus", …); the
 * structure carries the meaning. When `currentItemId` matches a piece,
 * that piece is amber-tinted with a "(this item)" marker. When
 * `linkToFullSet` is true, the set name is a link to the standalone
 * /armor-sets/[id] page.
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
  const pieces: ArmorSetPieceDto[] = [];
  for (const slot of slotOrder) {
    const piece = set.pieces[slot];
    if (piece) pieces.push(piece);
  }
  if (set.shield) pieces.push(set.shield.piece);

  const setIconFile = set.pieces.chest?.iconFile ?? null;

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
      <div className="flex items-start gap-3">
        <ItemIcon
          iconFile={setIconFile}
          name={set.name}
          size={32}
          decorative
        />
        <div className="flex min-w-0 flex-col gap-1">
          {linkToFullSet ? (
            <Link
              href={`/${chronicle}/armor-sets/${set.id}`}
              className="text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-100"
            >
              {set.name}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {set.name}
            </span>
          )}
          {set.bonusSkill?.description && (
            <span className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {set.bonusSkill.description}
            </span>
          )}
          <EffectsLine skill={set.bonusSkill} />
          {set.shield?.bonusSkill && (
            <span className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <span className="font-mono uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                With Shield:{" "}
              </span>
              {set.shield.bonusSkill.description ?? ""}
              <EffectsLine skill={set.shield.bonusSkill} inline />
            </span>
          )}
          {set.enchant6BonusSkill && (
            <span className="text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              <span className="font-mono uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                +6:{" "}
              </span>
              <EffectsLine skill={set.enchant6BonusSkill} inline />
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {pieces.map((piece) => (
          <PieceRow
            key={piece.itemId}
            chronicle={chronicle}
            piece={piece}
            isCurrent={piece.itemId === currentItemId}
          />
        ))}
      </div>
    </div>
  );
}

function PieceRow({
  chronicle,
  piece,
  isCurrent,
}: {
  chronicle: string;
  piece: ArmorSetPieceDto;
  isCurrent: boolean;
}) {
  const { name, bracket } = splitNameAndBracket(piece.name);
  const inner = (
    <>
      <ItemIcon
        iconFile={piece.iconFile}
        name={piece.name}
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
          {name}
        </span>
        {bracket && (
          <span className="text-zinc-500 dark:text-zinc-400">
            {" "}
            [{bracket}]
          </span>
        )}
        {isCurrent && (
          <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-amber-700 dark:text-amber-400">
            (this item)
          </span>
        )}
      </span>
    </>
  );

  if (isCurrent) {
    return (
      <div className="flex items-center gap-2 text-sm">{inner}</div>
    );
  }

  return (
    <Link
      href={`/${chronicle}/items/${piece.itemId}`}
      className="flex items-center gap-2 text-sm hover:underline"
    >
      {inner}
    </Link>
  );
}

function EffectsLine({
  skill,
  inline = false,
}: {
  skill: SkillSummaryDto | null | undefined;
  inline?: boolean;
}) {
  if (!skill) return null;
  const formatted = (skill.effects ?? [])
    .map(formatEffect)
    .filter((s): s is string => !!s);
  const unique = Array.from(new Set(formatted));
  if (unique.length === 0) return null;
  return (
    <span className={inline ? "text-[11px]" : "text-xs"}>
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
  );
}

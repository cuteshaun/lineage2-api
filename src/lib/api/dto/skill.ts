import type { Chronicle } from "../../chronicles";
import type { SkillEffect } from "../../types";
import { getSkillByKey } from "../../data/indexes";

/**
 * Public skill summary, used wherever the API surfaces a resolved skill
 * (item `skill`, SA variant `skills[]`, armor-set bonuses). Lives in its
 * own module so DTOs that need skill resolution can depend on it without
 * pulling in unrelated item / armor-set logic — and to keep cross-DTO
 * imports acyclic.
 */
export interface SkillSummaryDto {
  id: number;
  level: number;
  name: string;
  operateType: string | null;
  target: string | null;
  iconFile: string | null;
  description: string | null;
  /**
   * Raw `power` value from the skill XML. Semantics depend on `skillType`.
   * Exposed so consumers can format their own text; the DTO uses it
   * internally to derive a fallback description for SA variants whose
   * skills carry `"none"` as their canned description.
   */
  power: number | null;
  /**
   * Raw `skillType` (DRAIN / MDAM / …). Exposed for the same reason as
   * `power` — lets consumers decide formatting.
   */
  skillType: string | null;
  effects?: SkillEffect[];
}

/**
 * Generic, source-derived description for a skill whose canonical
 * description is `"none"` in `skillname-e.dat`. Uses the skill's
 * `skillType` + `power` fields as provably-true inputs — no editorial
 * text, no invented mechanics. Returns `null` when the skill's
 * structured data doesn't support a faithful sentence; callers should
 * leave such cases unresolved.
 *
 * Currently covers DRAIN skills (Critical Drain family). Other skill
 * types (MDAM, BUFF, DamOverTime, etc.) are deliberately not covered
 * because either the `power` semantics are ambiguous or the magnitude
 * lives in `<effect>` blocks the parser doesn't traverse.
 */
function deriveSkillDescription(
  skillType: string | null,
  power: number | null
): string | null {
  if (skillType === "DRAIN" && power != null) {
    const rounded =
      Math.abs(power) >= 1 ? Math.round(power) : Number(power.toFixed(1));
    return `During a critical attack, absorbs ${rounded} HP from target.`;
  }
  return null;
}

const PVP_STUB_SENTENCE = "Increases damage inflicted during PvP.";
// Strips a trailing clause about PvP damage, whether it's a separate sentence
// ("…HP. Inflicts additional damage during PvP.") or conjunctive
// ("…rate and damage inflicted during PvP." / "…Speed and enhances damage
// to target during PvP."). The clause must open with a specific verb (or
// literal "damage") so we don't swallow preceding unrelated conjunctions
// like "…Accuracy, and enables the character to attack multiple opponents and
// inflicts additional damage during PvP." — only the rightmost " and inflicts
// …" clause is stripped there, keeping the multi-target phrase intact.
const PVP_TRAILING_CLAUSE =
  /\s*(?:\.\s+|,\s+|\s+and\s+)(?:Inflicts|Increases|Enhances|inflicts|increases|enhances|damage)[^.,]*\s+during PvP\.\s*$/;

function normalizeDescription(raw: string | null): string | null {
  if (!raw || raw === "none") return null;
  if (raw === PVP_STUB_SENTENCE) return null;
  const stripped = raw.replace(PVP_TRAILING_CLAUSE, "").trimEnd();
  if (stripped.length === 0) return null;
  return /[.!?]$/.test(stripped) ? stripped : stripped + ".";
}

/**
 * Round a raw `<for>`-block effect value into a clean, consumer-friendly
 * number. Only applies to `add` entries (mul is rendered as a percent
 * delta elsewhere). Values ≥ 1 round to integers (32.05 → 32); values
 * below 1 keep one decimal so tiny magnitudes like MP regen 0.54 don't
 * collapse to 1. Done here so every API consumer — not just the UI —
 * gets normalized numbers in `SkillSummaryDto.effects`.
 */
function roundEffectValue(op: "mul" | "add", value: number): number {
  if (op === "mul") return value;
  if (Math.abs(value) >= 1) return Math.round(value);
  return Number(value.toFixed(1));
}

export function resolveSkill(
  chronicle: Chronicle,
  itemSkill: string | null
): SkillSummaryDto | undefined {
  if (!itemSkill) return undefined;
  const skill = getSkillByKey(chronicle, itemSkill);
  if (!skill) return undefined;
  const description =
    normalizeDescription(skill.description) ??
    deriveSkillDescription(skill.skillType, skill.power);
  const roundedEffects = skill.effects?.map((e) => ({
    ...e,
    value: roundEffectValue(e.op, e.value),
  }));
  return {
    id: skill.id,
    level: skill.level,
    name: skill.name,
    operateType: skill.operateType,
    target: skill.target,
    iconFile: skill.iconFile,
    description,
    power: skill.power,
    skillType: skill.skillType,
    ...(roundedEffects && roundedEffects.length > 0
      ? { effects: roundedEffects }
      : {}),
  };
}

# Public API contract

This document records what the public API guarantees, distinct from the
broader API overview in [`api.md`](./api.md). It is the reference for:

- which DTO fields are stable vs. experimental,
- the boundary between **public** (DTO) and **raw** (generated JSON),
- the rounding / normalization rules applied at the DTO layer,
- how this contract is mechanically enforced (snapshot tests).

The single source of truth for actual behavior is the snapshot suite at
`tests/items.snapshot.test.ts` plus the captured fixtures in
`tests/__snapshots__/`. Anything documented here that contradicts a fixture
is wrong; the fixture wins.

## Public vs. raw

| Layer | Files | Role |
|---|---|---|
| **Public API** (contract) | `src/lib/api/dto/*.ts` (`ItemDetailDto`, `SaVariantDto`, `SkillSummaryDto`, …), API responses under `/api/[chronicle]/...` | What consumers depend on. Stable shape, normalized values, deduplicated where appropriate. |
| **Raw / generated** (engine truth) | `data/generated/interlude/*.json` produced by `pnpm build:data` from aCis XML. The internal `Skill`, `Item`, `Npc`, `NpcDrops`, `Recipe` types in `src/lib/types.ts`. | Faithful to the engine. Not a contract. May change shape as the parser improves. **Not guaranteed to consumers.** Do not couple to it. |

DTOs are allowed to: deduplicate, normalize (round / collapse), reshape,
and enrich with already-generated metadata. DTOs must not invent mechanics
or fabricate text that isn't supported by source data.

## `ItemDetailDto` — stable fields

All fields listed below appear in every fixture for an item-detail
response. Their presence and shape are part of the contract. Values may
be `null` per type; the field itself is always emitted.

| Field | Type | Notes |
|---|---|---|
| `id` | number | Item id |
| `name` | string | Item name |
| `type` | `"weapon" \| "armor" \| "etcitem"` | |
| `grade` | `"none" \| "d" \| "c" \| "b" \| "a" \| "s"` | |
| `weight` | number \| null | |
| `price` | number \| null | |
| `material` | string \| null | |
| `bodypart` | string \| null | Normalized via `BODYPART_LABELS` (e.g. `"rhand"` → `"One-handed"`) |
| `weaponType`, `armorType`, `etcItemType` | string \| null | One of the three is set per `type` |
| `isStackable`, `isTradable`, `isDropable`, `isSellable` | boolean \| null | |
| `soulshots`, `spiritshots`, `mpConsume`, `reuseDelay` | number \| null | |
| `itemSkill` | string \| null | Raw `"id-level"` reference (or semicolon-joined for items with multiple) |
| `isMagical` | boolean \| null | |
| `crystalCount` | number \| null | |
| `pAtk`, `mAtk`, `pDef`, `mDef`, `rCrit`, `pAtkSpd`, `rShld`, `sDef`, `accCombat`, `rEvas` | number \| null | Combat stats |
| `iconFile` | string \| null | Filename inside `public/icons/` |

### Optional sections (present only when applicable)

| Field | When present |
|---|---|
| `skill?: SkillSummaryDto` | Item has a non-null `itemSkill` that resolves |
| `specialAbilityOptions?: SaVariantDto[]` | Base weapon has at least one SA variant grouped under it |
| `pvpBonus?: { damageMultiplier; display }` | Base weapon is `grade ∈ {a, s}` AND has `specialAbilityOptions` |
| `baseWeaponId?: number` | Item is itself an SA variant; reverse link to its base |
| `crafting?: CraftingInfoDto` | Item is a recipe scroll |
| `craftedBy?: CraftedByDto[]` | Item is produced by one or more recipes |
| `partOfSets?: ArmorSetDetailDto[]` | Item is listed as a piece in one or more armor sets. **Plural** — one item (Tallum Helmet 547) can belong to several sets (Heavy / Light / Robe). Order is the natural set-id order. Each entry is the **full** armor-set detail (same shape as `GET /api/[chronicle]/armor-sets/{id}`) — pieces with icons, bonus skill resolved, optional shield + enchant6 bonuses — so consumers can render the set in place without a second round-trip. |
| `specialAbilityOptions[].saveMechanic?` | Variant has `mp_consume_reduce` or `reduced_soulshot` in its raw `properties` |
| `specialAbilityOptions[].statDelta?` | Variant is a Light (weight delta) or Quick Recovery (reuseDelay delta) SA |

Reference fixtures:
- `Angel Slayer (6367)` — S-grade weapon with `pvpBonus`, `specialAbilityOptions`, no recipe
- `Falchion (68)` — beginner gear, no `pvpBonus`, no SA effects
- `Draconic Bow (7575)` — full SA section with all three flavors (skill / oncrit / save-mechanic) and `craftedBy`

## `SaVariantDto` — stable fields

| Field | Type | Notes |
|---|---|---|
| `itemId` | number | Variant's own item id |
| `name` | string | e.g. `"Draconic Bow - Cheap Shot"` |
| `saName` | string | Suffix after `" - "` |
| `iconFile` | string \| null | |
| `effectChance` | number \| null | From `properties.oncrit_chance` or `properties.oncast_chance` (oncrit takes precedence) |
| `skills` | `SkillSummaryDto[]` | Resolved from `itemSkill` (semicolon-split) + `oncrit_skill` + `oncast_skill`, deduplicated by `id-level` |
| `saveMechanic?` | `{ kind, chance, amount }` | Optional |
| `statDelta?` | `{ stat, deltaPercent, display }` | Optional |

## `SkillSummaryDto` — stable fields

| Field | Type | Notes |
|---|---|---|
| `id`, `level` | number | |
| `name` | string | Engine-side skill name |
| `operateType` | string \| null | `OP_PASSIVE` / `OP_ACTIVE` / `OP_TOGGLE` / null |
| `target` | string \| null | |
| `iconFile` | string \| null | |
| `description` | string \| null | Player-facing text. Either from `skillname-e.dat` (with PvP-stub trailing clauses stripped) or derived from `skillType + power` for DRAIN skills. `null` when no usable text is available — never invented. |
| `effects?` | `SkillEffect[]` | Parsed `<for>` `<mul>` / `<add>` entries (with table-ref resolution). `add` values are normalized; see Rounding rules below. |

### Experimental / passthrough

| Field | Notes |
|---|---|
| `power` | Raw skill `power` attribute (literal or table-ref-resolved). Semantics depend on `skillType`. May be exposed as-is by consumers; the DTO already uses it internally for DRAIN derivation. May change as more derivation patterns are added. |
| `skillType` | Raw `skillType` (DRAIN / MDAM / BUFF / DEBUFF / …). Same caveat as `power`. |

## Rounding / normalization rules at the DTO layer

Applied inside `resolveSkill` ([`src/lib/api/dto/item.ts`](../src/lib/api/dto/item.ts)):

- **`add` effect values** — clean to integer when `|value| >= 1`, otherwise keep one decimal. Examples: `32.05 → 32`, `248.56 → 249`, `0.54 → 0.5`.
- **`mul` effect values** — passed through raw. The percent delta is computed at the rendering layer (`Math.round((v - 1) * 100)`).
- **PvP triple multipliers** (`pvpPhysDmg`, `pvpPhysSkillsDmg`, `pvpMagicalDmg`) — kept in the raw `effects[]` for transparency but excluded from rendered shared/per-variant lines; surfaced as a single `pvpBonus` field on `ItemDetailDto` instead.
- **Description text** — `"none"` (engine placeholder) collapses to `null`. Trailing PvP-clause patterns (e.g. `"… Increases damage inflicted during PvP."`) are stripped to keep the player-facing text clean.
- **DRAIN derivation** — when a skill has `skillType="DRAIN"` and `power != null` and no usable description, we synthesize `"During a critical attack, absorbs {power} HP from target."` (with `power` rounded the same way as `add` effect values). No other skill types are derived; we leave them unresolved per the "no fabrication" rule.

## `ArmorSetListDto` — stable fields (`GET /api/[chronicle]/armor-sets`)

| Field | Type | Notes |
|---|---|---|
| `id` | number | Synthetic position-based id assigned at parse time (1..N over `armorSets.xml`). Stable as long as the source XML order is stable. |
| `name` | string | Set name from XML. **Not unique** — `"Mithril Robe Set"` collides; consumers should use `id`, not `name`, to disambiguate. |
| `pieceCount` | number | Number of equipment slots required by this set (1..5). `chest` is always present, so always `>= 1`. |

List endpoint accepts `q` (case-insensitive name substring), `limit` (default 50, max 200), `offset`. No sort param yet.

## `ArmorSetDetailDto` — stable fields (`GET /api/[chronicle]/armor-sets/[id]`)

| Field | Type | Notes |
|---|---|---|
| `id` | number | Same synthetic id as the list shape. |
| `name` | string | Same as the list shape. |
| `pieces` | `{ chest, legs?, head?, gloves?, feet? }` | Each piece is `{ itemId, name, iconFile }` (mirrors `CraftingIngredientDto`). `chest` is always present; other slots are present only when required by the set (XML `0` sentinels are dropped). |
| `bonusSkill` | `SkillSummaryDto \| null` | Main set bonus, fully resolved with description + effects. `null` only when the skill ref fails to resolve (defensive — not expected in current data). |
| `shield?` | `{ piece, bonusSkill }` | Present only for sets with a shield slot. `piece` is an `ArmorSetPieceDto`; `bonusSkill` is a `SkillSummaryDto \| null` (same nullability semantics as the main `bonusSkill`). |
| `enchant6BonusSkill?` | `SkillSummaryDto \| null` | Present only when the set carries an enchant-6 bonus. Same skill-summary shape with description + effects. |

Reference fixtures (`tests/__snapshots__/armor-sets.dto.snapshot.test.ts.snap`):
- **Wooden Set** — smallest (chest + legs + head only, no shield, no enchant6).
- **Tallum Heavy Set** — mid-complexity (4 pieces, no shield, with enchant6).
- **Avadon Heavy Set** — full (5 pieces + shield bonus + enchant6).
- **Major Arcana Set** — caster (4 pieces, no shield, with enchant6).
- **Imperial Crusader Set** — largest (5 pieces + shield + enchant6).

### What deliberately is NOT on `ArmorSetDetailDto`

- **Partial-set tier bonuses** — the engine doesn't carry them in `armorSets.xml`. Bonuses are all-or-nothing.
- **Player-facing labels for set-specific stats** like `maxLoad`, `STR`, `DEX`, `WIT`, `MEN`, `runSpd` — these are exposed in `bonusSkill.effects[]` with raw stat keys; UI labeling is not part of the API contract.

### Cross-link from `ItemDetailDto`

Reverse direction is supported via `ItemDetailDto.partOfSets?: ArmorSetDetailDto[]`. Given an item id, the response embeds the **full** detail of every set the item is a piece of — not a compact reference, the same shape returned by the standalone `/armor-sets/{id}` endpoint. UIs can render set bonuses + piece lists in place. Reference fixture: Tallum Helmet (id 547) renders three full set details (Tallum Heavy / Light / Robe Sets).

## Engine-rule fields (not derived from a single skill / item)

- **`pvpBonus`** — applied to every A/S-grade weapon with SA variants. Encodes the soul-crystal augmentation rule rather than per-variant data. Always `{ damageMultiplier: 1.05, display: "+5% PvP Damage" }` when present.
- **Shared SA bonuses** (rendered in the UI) — strict intersection across a base's variants' parsed effects. Implemented in the page component, not the DTO.

## Grouping and deduplication

- **SA variant grouping** lives in [`src/lib/data/indexes.ts`](../src/lib/data/indexes.ts) (`buildSaIndex` block). Base weapon match: exact name, falling back to apostrophe-normalized comparison (handles `"Heaven's Divider"` ↔ `"Heavens Divider - X"`).
- **Variant dedup**: when the source dataset contains two items with the same SA name (e.g. C4-legacy `Carnage Bow - Critical Bleed` at id 4831 vs. Interlude `Carnage Bow - Critical Bleed` at id 5609), we keep the entry with more resolved skill signal; ties broken by higher itemId.
- **Polearm bases** (with intrinsic class passive `itemSkill: "3599-1"`) qualify as SA bases — the base predicate is `!name.includes(" - ")`, not `itemSkill === null`.

## What we deliberately don't expose

- Internal raw `Skill` / `Item` / `Npc` types from `src/lib/types.ts` — those are parser output, not contract.
- Raw XML attributes the parser captures but doesn't surface (e.g. `effectRange`, `castRange`, `magicLevel` may be exposed on `SkillSummaryDto` selectively but full Skill state is not promised).
- Skill `<effect>` blocks (DamOverTime, Stun, Slow magnitudes) — out of scope per [`CLAUDE.md`](../CLAUDE.md). Description text from `skillname-e.dat` is the player-facing surface for those; structured data is not parsed.
- Speculative editorial text. We don't fabricate descriptions for SAs whose source data carries no usable signal — they render with just their `saName` plus whatever structured fields apply.

## What's *not* on the contract yet

- `ItemListDto` (the list endpoint shape) is fixture-locked but minimally documented above; expand here if/when consumer feedback warrants.
- NPC and drop endpoints are stable in practice but aren't covered by this snapshot suite. Adding fixtures for them is a separate follow-up.

## Versioning

- Snapshot tests are the mechanical enforcement. Any DTO shape change must:
  1. Update `tests/__snapshots__/items.snapshot.test.ts.snap` in the same PR.
  2. Update this doc if the change touches a stable field.
  3. Carry an explicit comment on the PR explaining the breaking nature, if any.
- The 12 representative items in `tests/items.snapshot.test.ts` cover every enrichment path. Add new fixtures when a new code path is introduced (e.g. a new SA enrichment family).
- We do not currently version the API publicly. Until a `v1` is tagged, the contract above is a working contract — stable in practice, not guaranteed across major refactors.

## Adding a fixture

```bash
# 1. Pick the item id you want to lock down.
# 2. Add it to REPRESENTATIVE_ITEMS in tests/items.snapshot.test.ts.
# 3. Run vitest with the update flag once.
pnpm test -- -u

# 4. Inspect the diff in tests/__snapshots__/items.snapshot.test.ts.snap.
#    Confirm it matches expectations.
# 5. Commit both files.
```

## Related documents

- [`api.md`](./api.md) — external-facing API overview (endpoints, query params, examples).
- [`CLAUDE.md`](../CLAUDE.md) — project-wide engineering principles, scope, and out-of-scope notes.

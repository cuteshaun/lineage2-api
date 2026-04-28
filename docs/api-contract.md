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
| `partOfSets?: ArmorSetDetailDto[]` | Item is listed as a piece in one or more armor sets. **Plural** — one item (Tallum Helmet 547) can belong to several sets (Heavy / Light / Robe). Order is the natural set-id order. Each entry is the **full** armor-set detail — pieces with icons, bonus skill resolved, optional shield + enchant6 bonuses — so consumers can render the set in place without a second round-trip. The catalog endpoint (`GET /api/[chronicle]/armor-sets`) returns the same shape; there is no per-id detail endpoint. |
| `exchangeFrom?: ExchangeOptionDto[]` | Mammon exchanges that *produce* this item — answers "how do I obtain this?" Present on unsealed A/S armor + accessories. Plural by contract; current Mammon dataset is 1:1. |
| `exchangeFor?: ExchangeOptionDto[]` | Mammon exchanges that *consume* this item as an ingredient — answers "what can I exchange this for?" Present on sealed A/S armor + accessories. Plural by contract. |
| `usedAsSpellbook?: SpellbookSkillDto` | Present only when the item is a spellbook (entry in `data/xml/spellbooks.xml`). Single-valued — each spellbook teaches exactly one skill in source data. Carries `skillId`, `skillName`, `iconFile`, and `learnedBy: ClassRefDto[]` (every class that learns *any* level of the skill). |
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

## `ArmorSetDetailDto` — stable fields

Reachable via two paths, both returning the same per-set shape:

- `GET /api/[chronicle]/armor-sets` — catalog endpoint. Response is
  `{ data: ArmorSetDetailDto[], meta: { total, limit, offset } }`. All
  sets ship in one round-trip (51 entries on Interlude). No query
  params today; cross-endpoint param design is deferred. There is no
  per-id detail endpoint by design — the catalog is small enough to
  render in full, and any single set is also reachable by walking from
  one of its pieces.
- `GET /api/[chronicle]/items/{id}` → `partOfSets[]` — embedded shape.
  Locked by the items snapshot suite via Tallum Helmet (id 547), which
  exercises the N:M case with three sets.

The catalog is independently locked by
`tests/armor-sets.catalog.snapshot.test.ts`.

| Field | Type | Notes |
|---|---|---|
| `id` | number | Synthetic position-based id assigned at parse time (1..N over `armorSets.xml`). Stable as long as the source XML order is stable. |
| `name` | string | Set name from XML. **Not unique** — `"Mithril Robe Set"` collides; consumers should use `id`, not `name`, to disambiguate. |
| `pieces` | `{ chest, legs?, head?, gloves?, feet? }` | Each piece is `{ itemId, name, iconFile }` (mirrors `CraftingIngredientDto`). `chest` is always present; other slots are present only when required by the set (XML `0` sentinels are dropped). |
| `bonusSkill` | `SkillSummaryDto \| null` | Main set bonus, fully resolved with description + effects. `null` only when the skill ref fails to resolve (defensive — not expected in current data). |
| `shield?` | `{ piece, bonusSkill }` | Present only for sets with a shield slot. `piece` is an `ArmorSetPieceDto`; `bonusSkill` is a `SkillSummaryDto \| null` (same nullability semantics as the main `bonusSkill`). |
| `enchant6BonusSkill?` | `SkillSummaryDto \| null` | Present only when the set carries an enchant-6 bonus. Same skill-summary shape with description + effects. |

### What deliberately is NOT on `ArmorSetDetailDto`

- **Partial-set tier bonuses** — the engine doesn't carry them in `armorSets.xml`. Bonuses are all-or-nothing.
- **Player-facing labels for set-specific stats** like `maxLoad`, `STR`, `DEX`, `WIT`, `MEN`, `runSpd` — these are exposed in `bonusSkill.effects[]` with raw stat keys; UI labeling is not part of the API contract.

## `ExchangeOptionDto` — stable fields

Returned under `ItemDetailDto.exchangeFrom[]` / `exchangeFor[]`. One row
per multisell entry the item participates in.

| Field | Type | Notes |
|---|---|---|
| `multisellId` | number | Source multisell file id (e.g. `311262506`). Exposed for traceability/debugging; consumers shouldn't depend on stable values across chronicles. |
| `maintainEnchantment` | boolean | Whether the production preserves the ingredient's enchant level. Mirrors the source XML's `<list maintainEnchantment="…">` attribute. |
| `npc` | `{ id, name }` | NPC offering the exchange. Resolved from the multisell file's `<npcs><npc>` block. For the parsed Mammon-scoped subset, this is always Blacksmith of Mammon (id 31126). |
| `required` | `ItemQuantityDto[]` | Items consumed. For Mammon unseal: `[{ sealed item × 1 }, { Ancient Adena × N }]`. Order matches the source XML. |
| `produces` | `ItemQuantityDto` | Item produced. Single-valued — every parsed Mammon entry has exactly one `<production>`. |

`ItemQuantityDto` is the resolved `{ itemId, name, iconFile, count }`
shape used for both ingredients and productions. Item-id resolution is
the same path used elsewhere in the DTO; if an item id has been removed
from the chronicle, `name` falls back to `#<id>` and `iconFile` is
`null`.

### Scope

Only the five Mammon multisell files are parsed today:

| File id | Purpose |
|---|---|
| `311262504` | Unseal S-Grade Armor (14 entries) |
| `311262505` | Unseal S-Grade Accessories (3 entries) |
| `311262506` | Unseal A-Grade Armor (55 entries) |
| `311262507` | Unseal A-Grade Accessories (6 entries) |
| `311262508` | Reseal A-Grade Armor (24 entries) |

Total: 102 entries. Generic multisells (regular shops, dye merchants,
SA-related Mammon files `311262509`–`511`) are deliberately out of
scope.

Reference fixtures (`tests/items.snapshot.test.ts`):
- **Tallum Plate Armor (2382)** — unsealed A-grade with `exchangeFrom` populated.
- **Sealed Tallum Plate Armor (5293)** — sealed A-grade with `exchangeFor` populated.

## `ClassDetailDto` — stable fields (`GET /api/[chronicle]/classes/[id]`)

Player class with progression metadata + the full skill-learn table.
Class metadata (id, name, race, type, professionLevel, parent) is
sourced from the canonical `ClassId.java` enum so it stays
engine-truthful even if the class XML files are reorganised.

| Field | Type | Notes |
|---|---|---|
| `id` | number | Canonical class id (matches the L2 client's class numbering, 0–117 with gaps for engine dummies). Stable across all Interlude-derived servers. |
| `name` | string | Display name from the enum (e.g. `"Human Fighter"`, `"Phoenix Knight"`). |
| `race` | string | One of `"Human"`, `"Elf"`, `"Dark Elf"`, `"Orc"`, `"Dwarf"`. (No Kamael — added post-Interlude.) |
| `type` | string | `"Fighter"` / `"Mystic"` / `"Priest"`. Enum-derived. |
| `professionLevel` | number | `0` = base class, `1` = 1st profession, `2` = 2nd profession, `3` = 3rd profession. |
| `parentClassId` | number \| null | Direct parent class id; `null` for base classes. |
| `childClassIds` | number[] | Direct children — sorted by id, empty for 3rd-profession leaves. |
| `skills` | `ClassSkillLearnDto[]` | Sorted by `(skillId, skillLevel, minPlayerLevel)`. |

### `ClassSkillLearnDto` — stable fields

| Field | Type | Notes |
|---|---|---|
| `skillId`, `skillLevel` | number | Reference into `skills.json` — keyed via the same `"id-level"` convention used by `Item.itemSkill`. |
| `name`, `iconFile` | string / string \| null | Resolved from the existing skill record. **No new icon parser** — values come straight from `skills.json`. Falls back to `#<id>-<lvl>` and `null` if the skill fails to resolve. |
| `minPlayerLevel` | number | Player level required to learn the skill. |
| `spCost` | number | Skill point cost. |
| `spellbookItemId?` | number | Item id of the required spellbook from `spellbooks.xml`, when one exists. |

`ClassListDto` (`GET /api/[chronicle]/classes`) is the same shape minus
`childClassIds` and `skills`. Both endpoints ship full responses without
query params today; cross-endpoint param design is deferred.

Reference fixtures (`tests/classes.snapshot.test.ts`):
- **Human Fighter (0)** — base class, no parent, exercises root skill-learn shape.
- **Human Knight (4)** — 1st profession, exercises parent link + heavier skill list.
- **Phoenix Knight (90)** — 3rd profession, exercises deep-parent link.

### `SpellbookSkillDto` — stable fields (under `ItemDetailDto.usedAsSpellbook`)

| Field | Type | Notes |
|---|---|---|
| `skillId` | number | The skill the spellbook teaches. |
| `skillName`, `iconFile` | string / string \| null | Resolved from `skills.json` at level 1 (the source XML doesn't differentiate skill levels for spellbooks — one item teaches all levels). |
| `learnedBy` | `ClassRefDto[]` | Every class that can learn *any* level of the skill, sorted by class id. Each entry is a compact `{ id, name, professionLevel }` reference; **not** a full `ClassDetailDto` — that would recurse and balloon the response. |

Reference fixture: **Spellbook: Heal (1152)** in the items snapshot
suite locks the cross-link to all 6 classes that learn Heal (Human
Mystic, Cleric, Elven Mystic, Elven Oracle, Dark Mystic, Shillien Oracle).

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

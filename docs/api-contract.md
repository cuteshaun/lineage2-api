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

### Null vs absent policy

`ItemDetailDto` distinguishes two kinds of "no value":

- **`null`** — *known missing source data.* The source XML simply
  carries no value for the field. Reserved for the four
  always-emitted top-level fields below: `weight`, `price`,
  `material`, `iconFile`.
- **Absent** — *not applicable to this item type.* Optional groups
  (`category`, `stats`, `shots`, `timing`, `flags`, `crystal`) and
  their inner keys are **omitted entirely** when their underlying
  source value is null OR when the field doesn't make sense for
  the item type. Absence ≠ unknown.

This split lets consumers tell "the parser couldn't extract this"
apart from "this field doesn't apply to currency / dye / armor /
etc." Adena returns no `stats`, no `shots`, no `category` —
because none of those things describe a currency item. A weapon
that the parser couldn't extract a price for returns
`price: null` — consumers know the value is missing, not absent.

### Always-present top-level fields

| Field | Type | Notes |
|---|---|---|
| `id` | number | Item id |
| `name` | string | Item name |
| `type` | `"weapon" \| "armor" \| "etcitem"` | |
| `grade` | `"none" \| "d" \| "c" \| "b" \| "a" \| "s"` | |
| `weight` | number \| null | `null` = source missing |
| `price` | number \| null | `null` = source missing |
| `material` | string \| null | `null` = source missing |
| `iconFile` | string \| null | Filename inside `public/icons/`. `null` when no `iconFile` resolves on disk. |

### Optional groups (omitted when no inner key applies)

Each group is itself optional. Inside a group, individual keys are
also optional and omitted when the source value is null. Empty
groups are never emitted.

| Group | Inner keys | When present |
|---|---|---|
| `category?: ItemCategoryDto` | `bodypart?`, `weaponType?`, `armorType?`, `etcItemType?` (all `string` when present) | When at least one routing label applies. Weapons set `weaponType`; armor sets `armorType` and (usually) `bodypart`; categorised etcitems set `etcItemType`. `bodypart` is normalized via `BODYPART_LABELS` (e.g. `"rhand"` → `"One-handed"`). |
| `stats?: ItemStatsDto` | `pAtk?`, `pDef?`, `mAtk?`, `mDef?`, `rCrit?`, `pAtkSpd?`, `rShld?`, `sDef?`, `accCombat?`, `rEvas?` (all `number`) | When the item has any combat stat. Weapons and most armor pieces; absent on jewelry that ships no stat block in source, and on all etcitems / currency. |
| `shots?: ItemShotsDto` | `soulshots?`, `spiritshots?`, `mpConsume?` (all `number`) | When the item declares per-attack/per-cast consumption. Weapons (shots) and skill-bearing items (`mpConsume`). |
| `timing?: ItemTimingDto` | `reuseDelay?: number` | When the item declares a reuse cooldown. Currently a single-key group — kept as a group for forward-compatibility with future timing fields. |
| `flags?: ItemFlagsDto` | `stackable?`, `tradable?`, `dropable?`, `sellable?`, `magical?` (all `boolean`) | When the source declares any of these flags. Inner keys drop the `is` prefix (the grouping makes it redundant). `dropable` keeps the engine spelling. |
| `crystal?: ItemCrystalDto` | `count: number` (required *inside* the group) | When the item has a non-null `crystalCount` in source. The group is the optional bit; once present, `count` is always set. |

### Other optional top-level fields

| Field | Type | When present |
|---|---|---|
| `itemSkill?` | string | Raw `"id-level"` reference (or semicolon-joined for items with multiple). The resolved version lives in `skill?` below. |

### Optional cross-link / detail blocks (present only when applicable)

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
| `soldBy?: ShopOfferDto[]` | Direct merchants selling this item for Adena. Sourced from `buyLists.xml`. Sorted by `price` ascending then NPC id. Distinct from `exchangeFrom` (multi-ingredient exchange) — the two never overlap. |
| `rewardedByQuests?: RewardedByQuestDto[]` | Quests that grant this item as a final reward, paired with the per-quest count. Each row is `{ quest: QuestRefDto, count: number }`. Sorted by `quest.id` ascending. **Adena (item 57) is included** via the `q.rewards.adena` scalar — when the player opens the Adena item page they see every quest that grants Adena with the per-quest amount as `count`. For ordinary items `count` comes from the matching `q.rewards.items[].count` row (always ≥ 1; current Interlude data ranges 1–500). Inherits the same heuristic-extraction limitations as `QuestRewardsDto` — quests whose final-reward call doesn't land in the proximity window are silently absent. |
| `questItemFor?: QuestRefDto[]` | Quests that register this item via `setItemsIds(...)` — engine-tracked transient items. An item is rarely both `rewardedByQuests` and `questItemFor`. |
| `henna?: HennaSummaryDto` | Present only when the item is a henna dye (entry in upstream `hennas.xml`, indexed by `dyeItemId`). Single-valued — every dye maps 1:1 to a single symbol in source data. Carries the resolved `HennaSummaryDto` with display fields, stat deltas, price, and the dye-item ref. See "`HennaSummaryDto` — stable fields" below. |
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
| `multisellId` | number | Source multisell file id. Exposed for traceability only — consumers shouldn't pin to specific values; the allow-list grows over time. |
| `maintainEnchantment` | boolean | Whether the production preserves the ingredient's enchant level. Mirrors the source XML's `<list maintainEnchantment="…">` attribute. |
| `npcs` | `NpcRefDto[]` | All NPCs offering this exchange, from the source `<npcs>` block. Plural by design — many real multisells (e.g. B-grade unseal) list 14+ town blacksmiths in one file. NPCs that fail to resolve are dropped. |
| `required` | `ItemQuantityDto[]` | Items consumed. **Castle-tax Adena is summed into the main Adena ingredient** (engine raw split via `isTaxIngredient="true"` is not preserved in the public DTO — consumers see one Adena cost, not two). |
| `produces` | `ItemQuantityDto` | Item produced. Single-valued — every parsed entry has exactly one `<production>`. |

`ItemQuantityDto` is the resolved `{ itemId, name, iconFile, count }`
shape used for both ingredients and productions. Item-id resolution is
the same path used elsewhere in the DTO; if an item id has been removed
from the chronicle, `name` falls back to `#<id>` and `iconFile` is
`null`.

### Scope

Curated allow-list — 11 multisell files parsed today:

| File id | Purpose | NPCs |
|---|---|---|
| `311262504` | Mammon: unseal S-grade armor | 1 (Blacksmith of Mammon) |
| `311262505` | Mammon: unseal S-grade accessories | 1 |
| `311262506` | Mammon: unseal A-grade armor | 1 |
| `311262507` | Mammon: unseal A-grade accessories | 1 |
| `311262508` | Mammon: reseal A-grade armor | 1 |
| `1002` | B-grade unseal | 14 town blacksmiths |
| `1003` | B-grade reseal | 14 town blacksmiths |
| `1235` | Apella Trader (clan armor; Clan Reputation + Adena) | 2 clan traders |
| `300974001` | Luxury Shop weapons (Trader Galladucci) | 1 |
| `300984001` | Luxury Shop armor (Trader Alexandria) | 1 |
| `300984002` | Luxury Shop misc (Trader Alexandria) | 1 |

Quest exchanges, manor crop conversion, SA insertion/removal, dyes,
shadow weapons, pet equipment swaps, and newbie scrolls are
deliberately out of scope. They live in their own milestones.

Reference fixtures (`tests/items.snapshot.test.ts`):
- **Tallum Plate Armor (2382)** — unsealed A-grade with `exchangeFrom`.
- **Sealed Tallum Plate Armor (5293)** — sealed A-grade with `exchangeFor`.
- **Sealed Apella Plate Armor (7871)** — multi-currency exchange (Clan Reputation + Adena + castle tax). Locks tax-collapse rule.
- **Zubei's Gauntlets - Heavy Armor (5710)** — first production of multisell 1002. Locks `npcs[]` with all 14 blacksmiths.

## `ShopOfferDto` / `ShopProductDto` — stable fields

Two views of the same `buyLists.xml` data — direct adena→item
purchases. Distinct from `ExchangeOptionDto` (multi-ingredient).

`ShopOfferDto` (item view; under `ItemDetailDto.soldBy[]`):

| Field | Type | Notes |
|---|---|---|
| `npc` | `NpcRefDto` | The merchant. |
| `price` | number | Adena cost. |
| `buyListId` | number | Source buyList id, exposed for traceability. |

`ShopProductDto` (NPC view; under `/npcs/[id]/shop` `buyList[]`):

| Field | Type | Notes |
|---|---|---|
| `itemId` | number | Item being sold. |
| `name`, `iconFile` | string / string \| null | Resolved from items.json. |
| `price` | number | Adena cost. |
| `buyListId` | number | Source buyList id. |

Both are sorted by `price` ascending then by NPC id (offer view) or
item id (product view).

## `GET /api/[chronicle]/npcs/[id]/shop` — endpoint contract

Returns one merchant's combined direct-buy + exchange offerings.

```jsonc
{
  "data": {
    "npc": { "id": 30298, "name": "Pinter" },
    "buyList": [ /* ShopProductDto[] — omitted when none */ ],
    "exchanges": [ /* ExchangeOptionDto[] — omitted when none */ ]
  }
}
```

- 200 with one or both fields omitted when the NPC exists but has no shop data.
- 404 only when the NPC id is unknown.
- Mirrors `/spawns` behavior (200 with empty when no data, 404 only on unknown id).

`buyList` skips `npcId="-1"` sentinel entries from the source XML
(212 entries on Interlude — admin/debug lists not bound to any
merchant). `exchanges` covers only the curated multisell allow-list
above.

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
| `allowedHennas?` | `HennaSummaryDto[]` | Henna symbols this class is permitted to engrave at a Symbol Maker. Sorted by `symbolId` ascending. **Plural** — most Interlude classes have ~36 (Human Fighter) to ~50+ (multi-stat eligible classes) hennas in their allow-list. Omitted entirely when the chronicle ships no `hennas.xml`. See "`HennaSummaryDto` — stable fields" below. |

### `ClassSkillLearnDto` — stable fields

| Field | Type | Notes |
|---|---|---|
| `skillId`, `skillLevel` | number | Reference into `skills.json` — keyed via the same `"id-level"` convention used by `Item.itemSkill`. |
| `name`, `description`, `iconFile` | string / string \| null / string \| null | Resolved from the existing skill record. **No new icon parser** — values come straight from `skills.json`. `name` falls back to `#<id>-<lvl>`; `description` and `iconFile` fall back to `null` if the skill fails to resolve or has no source description. |
| `minPlayerLevel` | number | Player level required to learn the skill. The aCis source XML deliberately uses tier-of-3 progression — the same skill often has 3 consecutive `skillLevel` entries with the same `minPlayerLevel`. This is engine truth, not duplication. |
| `spCost` | number | Skill point cost — paid every time the player learns a new level. |
| `mpConsume` | number \| null | MP consumed each time the skill is cast at this level. `null` for passives/toggles with no MP cost in source data. |
| `spellbook?` | `SpellbookItemRefDto` | Spellbook item required to **first** learn this skill. Surfaced only on the **lowest-skillLevel row per skill** in the class — engine-truth, the book is consumed once per skill family, not once per level. Omitted entirely when no spellbook is required. |

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

## `QuestDetailDto` — stable fields (`GET /api/[chronicle]/quests/[id]`)

Quest catalog parsed mechanically from aCis Java quest scripts, with a single
optional flavor field merged from the L2 client's `questname-e.dat`.
Walkthrough text and HTML dialogue remain **not** included — those would
require either narrative-prose extraction or a manual editorial layer, both
out of scope. The Java fields below are engine-truthful (regex over the
quest scripts; no AST, no NLP); `description` is purely additive on top.

| Field | Type | Notes |
|---|---|---|
| `id`, `name` | number / string | From `super(id, "name")` in the quest's constructor. Always present. |
| `scriptFile` | string | Source filename for traceability, e.g. `"Q001_LettersOfLove.java"`. |
| `levelMin` | number \| null | Smallest `getLevel() < N` constraint in the quest's `STATE_CREATED` branch. `null` when no level gate is encoded. **`levelMax` is intentionally absent** — `questname-e.dat` does not carry a reliable max-level field on Interlude (the per-record leading uint32 produces values like 138 that don't behave as a level cap), so M3B does not surface one. |
| `repeatable` | boolean \| null | From `exitQuest(true\|false)`. `null` when the script never calls `exitQuest` (rare). |
| `raceRestrictions` | string[] | Canonical aCis enum names ("HUMAN", "ELF", "DARK_ELF", "ORC", "DWARF") from positive-form `getRace() == ClassRace.X` checks. Negative-form gates (`!=`) are not surfaced — they're common across many classes and would clutter the public DTO. Empty when no race gate is encoded. |
| `classRestrictions` | `ClassRefDto[]` | Resolved against `classes.json` from `ClassId.X` enum references in `==` / `equalsOrChildOf` checks. Empty when no class gate is encoded. |
| `startNpcs` | `NpcRefDto[]` | From `addStartNpc(...)`. Typically 1, plural for the rare multi-start case. |
| `involvedNpcs` | `NpcRefDto[]` | From `addTalkId(...)`. Player-friendly: "who do I talk to during this quest". |
| `involvedMonsters` | `NpcRefDto[]` | From `addKillId(...)`. Player-friendly: "what do I kill". |
| `questItems` | `ItemQuantityDto[]` | From `setItemsIds(...)` declared at top of constructor. **`count` is always 0** — the engine list registers item ids but doesn't carry quantities; the field shape exists for parity with `ItemQuantityDto` and to preserve item icon/name resolution. |
| `rewards` | `QuestRewardsDto` | See "Reward extraction" below. |
| `description?` | string | Player-facing flavor prose from the L2 client's `questname-e.dat` (e.g. *"Darin, a young man on Talking Island, carries a torch for Gatekeeper Roxxy, who doesn't return his affections."*). **Additive**: Java-derived fields above are authoritative — `description` is never used to override `name`, `levelMin`, `repeatable`, `raceRestrictions`, `classRestrictions`, `rewards.*`, `startNpcs`, `involvedNpcs`, `involvedMonsters`, `questItems`, or `scriptFile`, even when the DAT carries its own value for them. Omitted when the chronicle doesn't ship a `questname-e.dat` (gated by `questNameDatFile` in `chronicle-sources.ts`) or the quest has no DAT counterpart. |
| `clientJournalEntries?` | `QuestClientJournalEntryDto[]` | In-game quest journal entries from the L2 client's `questname-e.dat`, one per step. Each entry carries the short journal `title` (e.g. `"Delivery of Love Letters"`), full prose `description` (verbatim from the DAT — no truncation), and a resolved `completionNpc: NpcRefDto \| null`. NPC name resolution accepts both the bare `name` (`"Roxxy"`) and the client-display `"<title> <name>"` form (`"Gatekeeper Roxxy"`). **Honesty note**: this is what the L2 client log shows, not a mechanically-derived walkthrough — consumers should render it as the journal, not as an editorial walkthrough. Ordered by `stepIndex` ascending. Omitted when the DAT carries no step rows for the quest (chronicles without a DAT, or quests without a DAT counterpart). |
| `primaryRegion?` | `RegionRefDto` | The first start NPC's primary region (mode-of-spawns rule, lowest-id tiebreak — same algorithm as `NpcDetailDto.primaryRegion?`). Answers "where do I start this quest?" without a second round-trip. **Multi-start-NPC caveat**: a handful of saga quests have multiple start NPCs in different regions — this field reflects the **first** start NPC's region only. The full picture is reachable via `startNpcs[]` → NPC-detail → `primaryRegion?`. Omitted when the quest has no start NPCs, the first start NPC has no spawns, every spawn falls outside the upstream `mapRegions.xml` tile grid, or the chronicle ships no `mapRegions.xml`. |

`QuestListDto` (`GET /api/[chronicle]/quests`) is a compact subset of the above: drops
`scriptFile`, `involvedNpcs`, `involvedMonsters`, `questItems`, and the full `rewards`
object; instead surfaces `startNpc` (single, first) and `rewardsPreview: { adena, exp, sp,
itemCount }` for at-a-glance browsing.

### `QuestRewardsDto` — proximity heuristic

The non-trivial extraction. aCis doesn't separate "intermediate `giveItems`" (transient
quest items mid-flow) from "final reward `giveItems`". We disambiguate via lexical
proximity: a `giveItems` / `rewardItems` / `rewardExpAndSp` call counts as a final reward
**iff** it appears within 20 lines back / 5 lines forward of an `exitQuest(...)` call in
the same file. Items registered via `setItemsIds(...)` are then **subtracted** from the
reward list — they're transient quest items by definition (the engine wipes them on
`exitQuest`), so any reward-window match for them is a false positive.

| Field | Type | Notes |
|---|---|---|
| `items` | `ItemQuantityDto[]` | Final reward items, deduped by item id with summed counts. Sorted by item id. Adena (57) is excluded — surfaced separately on `adena`. |
| `adena` | number \| null | Sum of all Adena (`giveItems(57, X)` / `rewardItems(57, X)`) within the proximity window. `null` when none. |
| `exp` | number \| null | Sum of all `rewardExpAndSp(exp, sp)` first-arg values within the window. |
| `sp` | number \| null | Same, second arg. |

Reward extraction is the riskiest mechanical extraction in M3. Snapshot fixtures lock 4
representative quests so any heuristic regression surfaces visibly.

### `QuestClientJournalEntryDto` — stable fields

These are **client quest log entries** sourced verbatim from the L2 client's
`questname-e.dat` — the same text the in-game quest journal renders. They are
**not** an editorial walkthrough and **not** a mechanically-derived action
checklist. Consumers should render them as the player's journal (which is what
they are), not as imperative steps. The numbered ordering reflects the DAT's
`stepIndex` field, not a guaranteed canonical walk path.

| Field | Type | Notes |
|---|---|---|
| `stepIndex` | number | 1-based step index, matching the DAT record header. Entries are ordered ascending by this field. |
| `title` | string | Short journal label the client displays (e.g. `"Delivery of Love Letters"`). |
| `description` | string | Full prose journal text the client shows when the step is active. **Carried verbatim** — including literal `\n` characters for line breaks. Truncation is a UI concern, not an API one. |
| `completionNpc` | `NpcRefDto \| null` | Resolved completion NPC for the step. Resolution matches against both the bare NPC `name` (e.g. `"Roxxy"`) and the client-display `"<title> <name>"` form (e.g. `"Gatekeeper Roxxy"`); the index entry that prevails for a given lookup string is documented in `cleanedNpcByName` (see `src/lib/data/indexes.ts`). `null` when the DAT step record has no NPC slot (multi-objective steps occasionally omit it) OR the supplied name doesn't match a known NPC in the chronicle. |

Across the current Interlude dataset: **2049 journal entries across 329 quests, 1857 (~91%) carry a resolved `completionNpc`**. The unresolved ~9% mostly fall into two buckets: multi-objective steps (no NPC slot at all) and DAT names that point at NPCs not present in the cleaned set (e.g. dynamically-spawned story NPCs). Both cases honestly land as `null` rather than guess.

### Scope notes

- **Walkthrough text, location, levelMax, quest type (party/solo/event/saga)** —
  none of these are reliably extractable from Java scripts, and the Interlude
  `questname-e.dat` either doesn't carry them or carries them in a form that
  doesn't survive Phase-0 verification (e.g. step descriptions are walkthrough
  prose, not structured short titles; the per-record leading uint32 doesn't
  behave as `levelMax`). The narrative `description` IS surfaced — see the
  optional row in the field table above. Other deferred items wait for M4
  (Locations) and any future manual-annotation pass.
- **HTML dialogue** stays internal — we don't publish walkthrough prose as guide content.
- **329 quests parsed** on Interlude (100% of the Java catalog has a
  `questname-e.dat` counterpart joined by id; the DAT also carries 13
  client-only stubs without Java counterparts that are silently ignored).
  Reference fixtures (`tests/quests.snapshot.test.ts`): Q001 (Letters of Love —
  simple intro), Q105 (Skirmish with the Orcs — kill quest), Q401 (Path to a
  Warrior — class restriction + exp/sp reward), Q211 (Trial of the Challenger —
  multi-step boss-kill with class gate, exercises proximity heuristic on a
  longer file).

### `QuestRefDto` shape

```ts
export interface QuestRefDto {
  id: number;
  name: string;
  levelMin: number | null;
  /** Populated only on `NpcDetailDto.involvedInQuests[]`. One or more of "talk", "kill". */
  roles?: string[];
}
```

Used in cross-links from items/NPCs back to quests
(`ItemDetailDto.rewardedByQuests[].quest`, `ItemDetailDto.questItemFor`,
`NpcDetailDto.startsQuests`, `involvedInQuests`).

### `RewardedByQuestDto` shape

```ts
export interface RewardedByQuestDto {
  quest: QuestRefDto;
  count: number;
}
```

Surfaced as `ItemDetailDto.rewardedByQuests?`.

For ordinary item rewards, `count` is the row's
`q.rewards.items[].count` (always ≥ 1). Adena (`itemId === 57`) is
the one engine special-case: the parser stores its reward as the
top-level scalar `q.rewards.adena` instead of a `rewards.items[]`
row, so the cross-link reads the scalar directly. This keeps the
Adena item page useful — opening it shows every quest that grants
Adena with the per-quest amount as `count`. Sorted by `quest.id`
ascending. Same heuristic-extraction caveats as `QuestRewardsDto`
apply.

## `NpcDetailDto` / `MonsterDetailDto` — stable fields

Both detail DTOs share the same `toNpcDetailDto` mapper. Stat values
come straight from the source `npc.xml` `<set name="…" val="…">`
attributes — **no engine simulation**, no rebalancing, no
synthesized fields.

### Null vs absent policy

- **Always present** top-level identity fields: `id`, `name`, `level`, `npcType`, `isAggressive`, `stats`, `baseStats`, `skills`. `level` and `npcType` are typed `… | null` because source occasionally omits them; on a real NPC in current Interlude data both are populated.
- **Optional identity fields** (`title?`, `race?`, `raceIconFile?`, `raceDescription?`) are **omitted when source carries no value**. About 65% of Interlude NPCs ship no title; race fields are populated only when the NPC carries a supported engine race-skill entry. Absence ≠ unknown.
- **`behavior?` group** is omitted on the 7 Interlude NPCs that have no `<ai>` block in source. When present, `aggroRange` is always set; `assistRange` is omitted on the ~67% of NPCs without a clan / `clanRange`.
- Within the `stats` and `baseStats` groups every key is required and `number`-typed (no nulls). Verified across all 6,472 Interlude NPCs; the defensive `| null` types in the previous shape never realized.

### Always-present top-level fields

| Field | Type | Notes |
|---|---|---|
| `id` | number | Cleaned NPC id (canonical id of the merged group). |
| `name` | string | NPC name from source. |
| `level` | number \| null | NPC level. |
| `npcType` | string \| null | Source `npc/[range]/.xml` `<set name="type">` (e.g. `"GrandBoss"`, `"RaidBoss"`, `"Folk"`, `"Merchant"`, `"Monster"`). |
| `isAggressive` | boolean | Derived from `behavior?.aggroRange > 0`. Top-level for parity with `NpcListDto.isAggressive`. |
| `skills` | `NpcSkillDto[]` | Always present. Empty array when the NPC has no skills (or all are filtered as engine-internal — e.g. the `4416` race-skill entry is consumed into the `race` field rather than surfaced here). |

### Optional identity fields

Each is omitted when the source value is `null`.

| Field | Type | Notes |
|---|---|---|
| `title?` | string | NPC title (e.g. `"Weapon Merchant"`). Present on ~35% of Interlude NPCs. |
| `race?` | string | Player-facing race label (e.g. `"Human"`, `"Undead"`, `"Beast"`). Resolved from the engine's race-skill (`skill 4416`) at level → race table — not source XML directly. Absent when the NPC has no race-skill entry. |
| `raceIconFile?` | string | Resolved icon for the race. Same provenance as `race`. |
| `raceDescription?` | string | Source description from `skill 4416-LEVEL`. Same provenance as `race`. |

### Required stat groups

Every NPC in source ships every key in both groups. **Source values, no engine simulation.**

| Group | Inner keys | Notes |
|---|---|---|
| `stats: NpcStatsDto` | `hp`, `mp`, `exp`, `sp`, `pAtk`, `pDef`, `mAtk`, `mDef`, `crit`, `atkSpd`, `walkSpd`, `runSpd` (all `number`) | `hp`/`mp`/`pAtk`/`pDef`/`mAtk`/`mDef` are rounded to integer at the DTO layer (some XML rows store floats like `300.8`); raw NPC routes preserve the float. Other keys pass through. |
| `baseStats: NpcBaseStatsDto` | `str`, `dex`, `con`, `int`, `wit`, `men` (all `number`) | Six base attributes from `<set name="str/dex/con/int/wit/men">`. Most NPCs in aCis ship the engine-default boss block `60/73/57/76/70/80`; ordinary monsters carry per-tier values (e.g. Grim Wolf 22001 ships `40/30/43/21/20/20`). |

### Optional `behavior?` group

| Field | Type | Notes |
|---|---|---|
| `behavior?.aggroRange` | number | Sight-aggro radius in game units, from `<ai aggro="…">`. **`0` is meaningful** — the NPC is passive (won't auto-attack on sight). Always present when the `behavior` group is present. |
| `behavior?.assistRange?` | number | Clan-assist radius in game units, from `<ai clanRange="…">`. Members of the same engine clan within this distance come help when this NPC is attacked. **Distinct from `aggroRange`** — sight-aggro is *"I see a player and attack"*; clan-assist is *"a clan member was attacked, I help"*. The internal clan slug (e.g. `"queen_ant_clan"`) is **not** exposed — it isn't meaningful to consumers and isn't cross-referenced anywhere player-facing. Omitted when the NPC has no clan / no `clanRange` in source. |

The `behavior` group itself is omitted on the 7 Interlude NPCs that ship no `<ai>` block in source — for those, the boolean `isAggressive` is `false`.

### Engine-derived fields we deliberately do NOT surface

- **Cast Speed (`mAtkSpd`)**, **Accuracy**, **Evasion** — not stored on the source XML; some L2 references compute them at render time from base stats × level via engine formulas. We don't simulate engine formulas (would be fabrication). Out of scope per AGENTS.md "no full game-mechanics emulation".
- **Rescaled HP / P.Atk / P.Def values to match other databases** — references like L2Hub or PTS dumps often publish different numbers for the same chronicle because they pull from a different datapack, a different formula layer, or runtime-computed values. **Differences vs L2Hub/PTS/other databases are source/reference differences, not parser bugs.** This API follows the bundled aCis Interlude datapack and does not rescale or synthesize engine-derived stats to match those references.

### `NpcDetailDto.startsQuests` vs `involvedInQuests` — dedup rules

`startsQuests` is the unfiltered list of quests where the NPC is in `Quest.startNpcIds`.
`involvedInQuests` is the additional-role list with these dedup rules:

- A quest already in `startsQuests` is re-listed under `involvedInQuests` **only** when the
  NPC has a non-trivial role beyond starting:
  - `kill` role: always re-listed (clear additional info — start NPC is also a kill target
    is genuinely interesting).
  - `talk` role: not re-listed when the NPC is also the start NPC (start NPCs almost always
    double as talk targets during the quest; that overlap is implicit and noise).
- Quests where the NPC has *only* kill or talk roles (not start) appear under
  `involvedInQuests` regardless.
- `roles` lists the contributing non-start roles, e.g. `["talk"]`, `["kill"]`,
  `["talk", "kill"]`. Omitted when empty (defensive — current parser always classifies).

`involvedInQuests` is detail-only; not surfaced on `NpcListDto`.

## `RegionRefDto` — stable fields

Compact reference to a named L2 map region. Used by:

- `EnrichedSpawnDto.region` — the resolved region for one spawn point.
- `NpcDetailDto.primaryRegion?` and `MonsterDetailDto.primaryRegion?` —
  the most-frequent region across an NPC/monster's cleaned spawns.
- `GET /api/[chronicle]/regions` — the public catalog (19 entries on
  Interlude).

| Field | Type | Notes |
|---|---|---|
| `id` | number | Numeric region id matching the upstream engine's `mapRegions.xml` (0..18 on Interlude). |
| `name` | string | Human-readable region name (e.g. `"Talking Island Village"`, `"Town of Aden"`, `"Primeval Isle"`). |

**Important semantics — engine "death-teleport" regions, not biome polygons.** aCis's `mapRegions.xml` table encodes which town/village the client teleports a player to on death within each tile of the geodata grid. It is **not** a precise biome or zone polygon. A monster in the Outlaw Forest, for example, will have its primary region resolved to "Town of Schuttgart" because that's the closest engine teleport point — even though "Outlaw Forest" is the name a player would use for the area. Consumers should treat the field as "the in-game town this NPC is associated with" rather than "this NPC's biome label". Finer-grained zone polygons (TownZone, SiegeZone, WaterZone, …) live in separate `data/xml/zones/*.xml` files and are a future milestone, not part of M4.

There is **no synthetic "Unknown" region**. Coordinates that fall outside the upstream tile grid resolve to `null`; chronicles that ship no `mapRegions.xml` produce empty `regions` lists and `null` everywhere downstream.

## `LocationRefDto` — stable fields

Compact reference to a player-facing L2 hunting / map location. Used by:

- `EnrichedSpawnDto.location` — the resolved location for one spawn point.
- `NpcDetailDto.primaryLocation?` / `MonsterDetailDto.primaryLocation?` /
  `QuestDetailDto.primaryLocation?` — the most-frequent location across
  the relevant cleaned spawns.
- `GET /api/[chronicle]/locations` — the public catalog (209 entries on
  Interlude).

| Field | Type | Notes |
|---|---|---|
| `id` | number | Numeric location id matching the L2 client's `huntingzone-e.dat` numbering. |
| `name` | string | Human-readable location name (e.g. `"Cruma Tower"`, `"Ant Nest"`, `"Sea of Spores"`, `"Tower of Insolence"`). |
| `minLevel` | number \| null | Recommended player level from the DAT. `null` for towns and other non-combat areas where the source value is `0` (normalized — `0` is the engine's "no level constraint" sentinel, not a real recommendation). |

**Important semantics — center anchors, not polygons.** Each catalog entry carries a single `(x, y, z)` center point. Spawn / detail resolution against a coordinate uses **nearest-anchor with a fixed 10000 game-unit 2D threshold** (Z is ignored), implemented in [`src/lib/data/indexes.ts`](../src/lib/data/indexes.ts) as `resolveLocationForCoordinate`. This is a **player-facing approximation, not a geometric containment check** — a spawn that sits between two anchors gets the closer one regardless of which polygonal area a player would say it belongs to. Coordinates farther than 10000 units from every anchor resolve to `null` rather than being snapped to the nearest distant anchor.

**Territory catch-alls dropped at parse time.** `huntingzone-e.dat` ships ~11 entries with `(x=0, y=0, z=0)` ("Dion Territory", "Aden Territory", etc.). These overlap the `mapRegions` table and have no spatial anchor — the parser drops them entirely, so they appear in neither the catalog nor any spawn / detail resolution.

**Complementary to `RegionRef`, not a replacement.** Regions name the engine's death-teleport town (M4); locations name the local hunting ground (M7). A monster in the Outlaw Forest resolves to *Town of Schuttgart* on `primaryRegion` and *Outlaw Forest* on `primaryLocation`.

There is **no synthetic "Unknown" location**. Out-of-threshold coordinates resolve to `null`; chronicles that ship no `huntingzone-e.dat` produce empty `locations` lists and `null` everywhere downstream.

## `EnrichedSpawnDto` — stable fields (cleaned spawn endpoints)

Returned by `GET /api/[chronicle]/npcs/[id]/spawns` and the cleaned-monster sibling. Each row is the underlying engine `Spawn` (`spawnlist.sql` + `raidboss_spawnlist.sql` + `grandboss_data.sql` merged) with one optional resolved field.

| Field | Type | Notes |
|---|---|---|
| `npcId` | number | Source NPC id this spawn point belongs to. |
| `x`, `y`, `z` | number | World coordinates. |
| `heading` | number | Facing direction (engine units). |
| `respawnDelay` | number | Seconds. `0` for grandboss rows = "engine-driven, source is silent" (not "instant"); same caveat applies to raidboss rows where `spawn_time = 0`. |
| `respawnRandom` | number | Seconds. |
| `periodOfDay` | number | `0`/`1`/`2` from `spawnlist.sql`; `0` ("Any") for raidboss/grandboss rows that don't carry the column. |
| `region` | `RegionRefDto \| null` | Resolved via `(x >> 15) + 4`, `(y >> 15) + 8` against the chronicle's `mapRegions.xml` tile grid. **Always present**, never omitted — `null` is the honest signal for unmapped grid cells, out-of-grid coords, or chronicles without a regions XML. The raw equivalent at `/api/[chronicle]/raw/monsters/[id]/spawns` does **not** carry this field; raw stays close to engine truth. |
| `location` | `LocationRefDto \| null` | Resolved via nearest-anchor against `huntingzone-e.dat` centers within a fixed 10000 game-unit 2D threshold (see `LocationRefDto` semantics above). **Always present**, never omitted — `null` is the honest signal for out-of-threshold coords or chronicles without a `huntingzone-e.dat`. The raw spawn endpoints do **not** carry this field. |

## `NpcDetailDto.primaryRegion?` / `MonsterDetailDto.primaryRegion?` — derivation rule

Both detail DTOs share the same `toNpcDetailDto` mapper, so the rule is identical for `/npcs/[id]` and `/monsters/[id]`.

- **Source**: cleaned-layer aggregated spawns (`getNpcSpawns`).
- **Aggregation**: count occurrences of each non-null resolved region across the NPC's spawns.
- **Selection**: most frequent region wins (mode by region id).
- **Tiebreak**: lowest region id wins on equal counts. Stable / deterministic / locked by snapshot.
- **Omission**: the field is **truly optional** (omitted, not `null`) when the NPC has no spawns at all OR every spawn falls outside the mapped grid OR the chronicle ships no `mapRegions.xml`. This is the one place in the API that uses optional-omission rather than always-present-with-`null`, because the player-facing detail page renders nothing for an unknown primary region.

Read `primaryRegion` as "the in-game town this NPC is most-often associated with" rather than "this NPC's geographic biome", per the engine semantics noted on `RegionRefDto`.

## `NpcDetailDto.primaryLocation?` / `MonsterDetailDto.primaryLocation?` / `QuestDetailDto.primaryLocation?` — derivation rule

Same shape as `primaryRegion?`, applied against the M7 hunting-zone catalog instead of `mapRegions`.

- **Source**: cleaned-layer aggregated spawns (`getNpcSpawns`) for NPC and monster detail; the **first** start NPC's spawns for quest detail (same multi-start caveat as `primaryRegion?`).
- **Aggregation**: count occurrences of each non-null resolved location across the spawns. Resolution uses the same nearest-anchor-with-threshold rule as `EnrichedSpawnDto.location` (see `LocationRefDto` above).
- **Selection**: most frequent location wins (mode by location id).
- **Tiebreak**: lowest location id wins on equal counts. Stable / deterministic / locked by snapshot.
- **Omission**: the field is **truly optional** (omitted, not `null`) when the NPC has no spawns at all OR every spawn falls outside the 10000-unit threshold of every anchor OR the chronicle ships no `huntingzone-e.dat`. Same omission semantics as `primaryRegion?`.

Read `primaryLocation` as "the player-facing hunting ground this NPC is most-often found in" — *Cruma Tower*, *Ant Nest*, *Sea of Spores*, etc. Complementary to `primaryRegion?`, which still answers "the in-game town this NPC is associated with".

## `HennaSummaryDto` — stable fields

Returned by:

- `GET /api/[chronicle]/hennas` — full catalog (180 entries on Interlude).
- `ItemDetailDto.henna?` — the henna engraved by a dye item (singular, 1:1 with `symbolId`).
- `ClassDetailDto.allowedHennas?` — every henna the class can engrave, sorted by `symbolId`.

| Field | Type | Notes |
|---|---|---|
| `symbolId` | number | Source XML symbol id (1..N). Stable across builds; **the canonical key** for hennas — `dyeItemId` collisions are not expected but `symbolId` is what consumers should pin to. |
| `displayName` | string \| null | Player-facing name from the L2 client's `hennagrp-e.dat` (e.g. `"Symbol of Strength"`). **Nullable**: `null` for the 9 +/− 4 "Greater II" tier symbols (Interlude `symbolId` 172–180), whose DAT records use a shared-prefix string compression that this build does not decode. We do **not** synthesize the name from `statChanges` or from the dye item — the field is honestly `null` rather than fabricated. |
| `iconFile` | string \| null | Resolved PNG basename inside `public/icons/` (e.g. `"etc_str_symbol_i00.png"`). Same convention as `Item.iconFile`. **Nullable** for the same Greater II symbols and for any symbol whose DAT slug fails to resolve to a file on disk. **Distinct from** `dyeItem.iconFile` — that's the dye *item* icon (`etc_str_hena_i00.png`); this is the *symbol* icon (`etc_str_symbol_i00.png`). |
| `shortLabel` | string \| null | Short stat label from the DAT, verbatim (e.g. `"Str+1 Con-3"`). **Nullable** for the same reasons as `displayName`. We do **not** synthesize this from `statChanges` even when the DAT lacks it. |
| `statChanges` | `HennaStatChangesDto` | Six-attribute object with optional `STR`/`CON`/`DEX`/`INT`/`MEN`/`WIT` signed integers. **Always populated** from `hennas.xml`. Missing keys mean "no change to this stat" — current Interlude data ships exactly two non-zero deltas per symbol. |
| `price` | number | Adena price the engraver charges. Always populated from XML. |
| `dyeItem` | `DyeItemRefDto` | The dye item the player buys and consumes. Resolved against `items.json` at request time. Carries `id`, `name`, and `iconFile` (the dye item icon, *not* the symbol icon). 1:1 with `symbolId` — the cross-validation step at parse time fails the build if a dye id does not resolve. |

**Honesty contract**. Hennas are **dye/symbol mechanics**, not cosmetic tattoos: a stat-altering engraving consumed at the Symbol Maker. The name "henna" survives from the original Korean client and the `hennas.xml` filename, so we keep it; the documentation strings in this DTO and the surrounding routes spell out the semantics.

### `HennaDetailDto` — stable fields

Same shape as `HennaSummaryDto` plus:

| Field | Type | Notes |
|---|---|---|
| `allowedClasses` | `ClassRefDto[]` | Classes permitted to engrave this symbol, resolved from the XML's `classes="…"` attribute. Sorted by class id ascending. **Always non-empty** in source data. Each entry is a compact `{ id, name, professionLevel }` reference; not a full `ClassDetailDto` — that would recurse. |

### What deliberately is NOT on the henna DTO

- **Symbol Maker NPC linkage.** The L2 client encodes the engraver / engraver-NPC mapping only in HTML dialogues, which we keep internal per the AGENTS.md hard rule. We do not curate a hand-written list either.
- **Cancellation cost.** The price to *remove* a henna (`dyeId/3` Adena, engine constant) is not surfaced. It's not in `hennas.xml` and not in the DAT.
- **Slot model.** The "max 3 hennas equipped" rule is an engine constant. Out of scope.
- **`HennaStatChangesDto.X = 0` keys.** Source data never carries zero deltas; we omit the key entirely when the source attribute is absent rather than emitting `0`.

Reference fixtures (`tests/hennas.snapshot.test.ts`):
- **`symbolId=1`** — first base-tier henna; broad fighter class allow-list; full DAT display.
- **`symbolId=7`** — Mystic-only (`Int+1 Men-3`), narrow class list.
- **`symbolId=37`** — first "Greater" tier; wide class list spanning multiple races.
- **`symbolId=171`** — last symbol with clean DAT display.
- **`symbolId=172`** — first Greater II tier symbol; honestly emits `displayName/iconFile/shortLabel: null`.
- **`symbolId=180`** — last Greater II tier symbol; same nullable display.

Item-side cross-link fixtures (in `tests/items.snapshot.test.ts`):
- **Item 4445** (Dye of STR (Str+1 Con-3)) — locks `henna?` cross-link with full display.
- **Item 4624** (Dye of MEN (Men-4 Wit+4)) — locks `henna?` with nullable display fields.

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
- Skill `<effect>` blocks (DamOverTime, Stun, Slow magnitudes) — out of scope per [`AGENTS.md`](../AGENTS.md). Description text from `skillname-e.dat` is the player-facing surface for those; structured data is not parsed.
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

## OpenAPI / Zod migration roadmap

The contract is enforced today by hand-written TypeScript interfaces
in `src/lib/api/dto/*.ts` plus snapshot fixtures under
`tests/__snapshots__/`. The long-term direction is a generated
OpenAPI spec backed by Zod schemas, but full migration is risky
to do in one shot and is being staged in three phases.

**Phase A (landed)** — eight small DTOs have parallel Zod schemas in
[`src/lib/api/schemas.ts`](../src/lib/api/schemas.ts):
`NpcRefDto`, `ClassRefDto`, `QuestRefDto`, M4's `RegionRefDto` and
`EnrichedSpawnDto`, M5's `QuestClientJournalEntryDto`, M7's
`LocationRefDto`, and M8's `HennaSummaryDto`. Each schema carries a
compile-time
`Expect<Equals<z.infer<typeof Schema>, ExistingDto>>` assertion, so
any drift between the schema and the hand-written interface fails
`pnpm typecheck`. A stub OpenAPI document
(`docs/openapi.stub.json`) is regenerated by `pnpm openapi`. The
schemas file is **not imported by route handlers**, so Zod stays
out of the runtime lambda bundle. Public response shapes are
unchanged by Phase A — schemas are an additive type-system safety
net, not a runtime validator.

**Phase B (deferred)** — migrate the larger DTOs (`ItemDetailDto`,
`NpcDetailDto`, `QuestDetailDto`, etc.) one at a time and switch
their TypeScript types to `z.infer<typeof ...>`, making schemas the
source of truth. Each migration must pass the existing snapshot
suite without diff. Routes still don't validate at runtime.

**Phase C (deferred)** — register every route's request/response in
the OpenAPI registry and generate a complete spec. The Phase-A stub
is already published at runtime via `GET /api/openapi.json`, so
Phase C is purely about widening `components.schemas` and populating
`paths` — not about distribution.

The roadmap is intentionally conservative: snapshots remain the
authoritative regression detector through all three phases. A bug
in the schemas can't ship a wrong response shape because the DTO
mappers don't consume them yet.

## v1 contract

The DTO surface above is treated as **stable** ahead of a `v1.0.0`
tag. This section spells out what "stable" means in this repo today
so consumers and future contributors share one baseline.

### What's locked

- **Field names and types** on every DTO documented in this file are snapshot-locked. Removing or renaming a field, or narrowing its type, is a breaking change requiring a major-version bump.
- **Response envelopes** are stable: single-entity responses are `{ data: T }`; list responses are `{ data: T[], meta: { total, limit, offset } }`; errors are `{ error: string, status: number }`. The `meta.total` field is always present on list endpoints, even when pagination is disabled (in which case `total === data.length` and `limit === total`).
- **The raw / public boundary** is stable. Raw endpoints (`/api/[chronicle]/raw/...`) carry no DTO enrichment fields and never gain them in v1.x. Cleaned-layer fields like `region`, `location`, `primaryRegion?`, `primaryLocation?`, `startsQuests` stay on the cleaned layer only.
- **Optional / nullable disclosure rules** are stable. Documented `null`s are returned as `null`, never silently omitted. Documented optional fields are omitted when their underlying source is empty, never returned as empty arrays or `null`.

### What's allowed without a major bump

- **Adding new optional fields** to existing DTOs.
- **Adding new endpoints**.
- **Widening enum-like string sets** (e.g. another `npcType` value if a chronicle introduces one).
- **Tightening or improving heuristic extraction** (e.g. recovering more quest-reward rows) — the field shape is stable, the *coverage* may grow.
- **Adding fixtures** to the snapshot suite.

### Honest limitations

Several documented fields inherit limitations from heuristic
extraction or partial source data. These are **stable behaviors**,
not bugs to be fixed under v1.x:

- `QuestRewardsDto` and `RewardedByQuestDto` use a lexical-proximity heuristic against `exitQuest()` calls in the Java scripts. Reward rows whose final-grant call doesn't land inside the proximity window are silently absent.
- `QuestDetailDto.clientJournalEntries[].completionNpc` resolves ~91% of step records on Interlude. The remaining ~9% are honestly `null` (multi-objective steps, or step NPCs absent from the cleaned NPC index).
- `LocationRefDto` resolution is *nearest-anchor with a fixed 10000-unit 2D threshold*, **not** polygon containment. Coordinates outside the threshold from every anchor resolve to `null`.
- `HennaSummaryDto.displayName` / `iconFile` / `shortLabel` are honestly `null` for the 9 +/− 4 "Greater II" tier symbols (Interlude `symbolId` 172–180); their DAT records use a shared-prefix string compression this build does not decode.

### What's marked experimental

A small number of fields are documented as passthroughs rather than
contract guarantees. These can change without a major-version bump
and should not be pinned by external consumers:

- `SkillSummaryDto.power` and `SkillSummaryDto.skillType` — raw XML attributes whose semantics depend on `skillType`.

### Versioning

`package.json` declares the project version. Pre-v1 (`0.x`) bumps follow the additive rules above. The first stable release is tagged `v1.0.0`; semver applies from that point.

## Related documents

- [`api.md`](./api.md) — external-facing API overview (endpoints, query params, examples).
- [`AGENTS.md`](../AGENTS.md) — project-wide engineering principles, scope, and out-of-scope notes.
- [`openapi.stub.json`](./openapi.stub.json) — auto-generated stub spec covering the Phase-A schemas. Regenerate with `pnpm openapi`.

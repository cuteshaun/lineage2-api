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
| `soldBy?: ShopOfferDto[]` | Direct merchants selling this item for Adena. Sourced from `buyLists.xml`. Sorted by `price` ascending then NPC id. Distinct from `exchangeFrom` (multi-ingredient exchange) — the two never overlap. |
| `rewardOfQuests?: QuestRefDto[]` | Quests that grant this item as a final reward. Sorted by quest id. Adena (item id 57) is excluded — quest adena lives on `QuestRewards.adena`, not in this list. |
| `questItemFor?: QuestRefDto[]` | Quests that register this item via `setItemsIds(...)` — engine-tracked transient items. An item is rarely both `rewardOfQuests` and `questItemFor`. |
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

Used in cross-links from items/NPCs back to quests (`ItemDetailDto.rewardOfQuests`,
`questItemFor`, `NpcDetailDto.startsQuests`, `involvedInQuests`).

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

**Phase A (landed)** — three small `Ref` DTOs (`NpcRefDto`,
`ClassRefDto`, `QuestRefDto`) have parallel Zod schemas in
[`src/lib/api/schemas.ts`](../src/lib/api/schemas.ts). Each schema
carries a compile-time `Expect<Equals<z.infer<typeof Schema>, ExistingDto>>`
assertion, so any drift between the schema and the hand-written
interface fails `pnpm typecheck`. A stub OpenAPI document
(`docs/openapi.stub.json`) is regenerated by `pnpm openapi`. The
schemas file is **not imported by route handlers**, so Zod stays
out of the runtime lambda bundle. Public response shapes are
unchanged in this phase.

**Phase B (deferred)** — migrate the larger DTOs (`ItemDetailDto`,
`NpcDetailDto`, `QuestDetailDto`, etc.) one at a time and switch
their TypeScript types to `z.infer<typeof ...>`, making schemas the
source of truth. Each migration must pass the existing snapshot
suite without diff. Routes still don't validate at runtime.

**Phase C (deferred)** — register every route's request/response
in the OpenAPI registry, generate a complete spec, and consider
publishing it (e.g. at `/api/openapi.json` or as a build artifact).
At this point the snapshot tests become a safety net rather than
the primary contract enforcement.

The roadmap is intentionally conservative: snapshots remain the
authoritative regression detector through all three phases. A bug
in the schemas can't ship a wrong response shape because the DTO
mappers don't consume them yet.

## Related documents

- [`api.md`](./api.md) — external-facing API overview (endpoints, query params, examples).
- [`AGENTS.md`](../AGENTS.md) — project-wide engineering principles, scope, and out-of-scope notes.
- [`openapi.stub.json`](./openapi.stub.json) — auto-generated stub spec covering the Phase-A schemas. Regenerate with `pnpm openapi`.

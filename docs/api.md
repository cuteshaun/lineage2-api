# Lineage 2 API

A read-only HTTP API over Lineage 2 datapack content (items, NPCs, drops),
served by a Next.js App Router app from generated JSON. Chronicle is part of
the URL path so future chronicles can coexist without endpoint changes.

## Scope and status

- **Currently supports the Interlude chronicle only.** The architecture is
  chronicle-aware and additional chronicles are planned, but only `interlude`
  is wired up today.
- **Backed by aCis Interlude datapack XML.** All current data is generated
  from a local aCis datapack checkout via `pnpm build:data`. The datapack
  itself is not redistributed.
- **Response shapes may still evolve** while the project is young. Treat
  field additions as expected and breaking changes as possible until a
  stable version is tagged.
- **Unofficial project.** Not affiliated with or endorsed by NCSoft. Lineage
  and Lineage 2 are trademarks of their respective owners.

## Base route

```
/api/[chronicle]/...
```

`[chronicle]` is required on every endpoint.

## Supported chronicles

| Chronicle  | Status |
|------------|--------|
| `interlude`| supported |

Requesting an unknown chronicle returns **404**.

## Endpoint summary

### Items

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/items` | List items (filter, sort, paginate) |
| GET | `/api/[chronicle]/items/[id]` | Single item by id (enriched: skill, SA, recipes, partOfSets) |
| GET | `/api/[chronicle]/items/[id]/dropped-by` | NPCs that drop this item (paginated) |
| GET | `/api/[chronicle]/items/[id]/spoiled-by` | NPCs that spoil this item (paginated) |

### NPCs / monsters (cleaned layer — default)

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/npcs` | List cleaned NPCs (one record per unique name) |
| GET | `/api/[chronicle]/npcs/[id]` | Single cleaned NPC; accepts canonical or any merged raw id |
| GET | `/api/[chronicle]/npcs/[id]/drops` | Aggregated drops for the cleaned NPC |
| GET | `/api/[chronicle]/npcs/[id]/spawns` | Aggregated spawn points for the cleaned NPC. Each row is an `EnrichedSpawnDto` and includes a resolved `region: RegionRefDto \| null` (M4); the raw equivalent at `/api/[chronicle]/raw/monsters/[id]/spawns` does **not** carry the region field. |
| GET | `/api/[chronicle]/npcs/[id]/shop` | Merchant's direct-buy products + curated multisell exchanges |
| GET | `/api/[chronicle]/monsters` | List monsters (cleaned NPC subset) |
| GET | `/api/[chronicle]/monsters/[id]` | Single monster by cleaned id |
| GET | `/api/[chronicle]/drops/npc/[id]` | Aggregated drops (alternate path, identical response) |

### NPCs / monsters (raw layer — source-faithful)

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/raw/npcs` | List every raw NPC row (no name dedup) |
| GET | `/api/[chronicle]/raw/npcs/[id]` | Single raw NPC by source id |
| GET | `/api/[chronicle]/raw/monsters` | Raw monster subset |
| GET | `/api/[chronicle]/raw/monsters/[id]` | Single raw monster by source id |
| GET | `/api/[chronicle]/raw/monsters/[id]/spawns` | Raw spawns for a single source id (no aggregation) |

### Armor sets

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/armor-sets` | Full armor-set catalog (rich, single-shot — no detail endpoint) |

### Classes

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/classes` | All player classes (89 on Interlude — base, 1st, 2nd, 3rd profession) |
| GET | `/api/[chronicle]/classes/[id]` | Single class with skill-learn table + parent/child cross-links |

### Quests

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/quests` | Full quest catalog (329 on Interlude). Compact `QuestListDto` with rewards preview. |
| GET | `/api/[chronicle]/quests/[id]` | Single quest with rewards, involved NPCs/monsters, quest items, race/class gates. Optional fields from M3B/M5: `description` (player-facing flavor prose from `questname-e.dat`); `clientJournalEntries` (per-step in-game quest log entries with title + prose + completion NPC); `primaryRegion` (the start NPC's region — same `mapRegions.xml` table used by NPC/monster details). Java fields remain authoritative; client/region enrichment is purely additive. |

### Regions

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/regions` | Full region catalog (19 on Interlude — Talking Island Village, Town of Aden, …). Source: upstream `mapRegions.xml`. **These are engine "death-teleport" regions**, not strict biome polygons — a coordinate's region is the in-game town the client teleports to on death within that tile. Cleaned `/npcs/[id]/spawns` enriches each spawn with `region: RegionRefDto \| null`; `NpcDetailDto`/`MonsterDetailDto` carry an optional `primaryRegion` derived from spawn aggregation. Raw spawn endpoints intentionally stay unenriched. |

### Locations

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/locations` | Full player-facing location catalog (209 spatial entries on Interlude — *Cruma Tower*, *Ant Nest*, *Sea of Spores*, *Tower of Insolence*, …). Source: L2 client's `huntingzone-e.dat` center anchors. **Not polygon-accurate** — each entry carries a single `(x, y, z)` center, and spawn / detail resolution uses **nearest-anchor with a fixed 10000-unit 2D threshold**. Coordinates outside that radius from every anchor resolve to `null`. Cleaned `/npcs/[id]/spawns` adds `location: LocationRefDto \| null` per row. `NpcDetailDto` / `MonsterDetailDto` / `QuestDetailDto` carry an optional `primaryLocation` (mode-of-spawns rule, lowest-id tiebreak). **Complementary to** `primaryRegion`, not a replacement: region is the coarse death-teleport anchor; location is the fine player-facing area. Territory catch-alls (*Dion Territory*, etc.) are excluded — they overlap `mapRegions`. |

### Hennas

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/hennas` | Full henna catalog (180 symbols on Interlude). Each entry is a `HennaSummary` — `symbolId`, `displayName`, `iconFile`, `shortLabel`, `statChanges`, `price`, and the `dyeItem` ref. Sorted by `symbolId`. |
| GET | `/api/[chronicle]/hennas/[symbolId]` | Per-symbol detail. Same fields as the catalog plus the resolved `allowedClasses: ClassRefDto[]`. |

Hennas are **dye/symbol mechanics**, not cosmetic tattoos: the player buys a dye item, takes it to a Symbol Maker NPC, pays the listed `price`, and engraves a symbol that applies the listed `statChanges` to their character. The mechanical fields (`statChanges`, `price`, `dyeItem`, `allowedClassIds`) come from upstream `hennas.xml` and are always populated. The display fields (`displayName`, `iconFile`, `shortLabel`) come from the L2 client's `hennagrp-e.dat`. For 9 of 180 symbols (the +/− 4 "Greater II" tier — Interlude `symbolId` 172–180), the DAT records use a shared-prefix string compression that this build does not decode; those rows honestly emit `displayName`/`iconFile`/`shortLabel: null` rather than synthesize values.

The same `HennaSummary` shape appears as a cross-link from item detail (`ItemDetailDto.henna?` on dye items, 1:1 with `symbolId`) and class detail (`ClassDetailDto.allowedHennas?`, sorted by `symbolId`). Symbol Maker NPC linkage is intentionally **not** surfaced — the L2 client carries it only in HTML dialogue, which we keep internal.

### Meta (filter dropdowns)

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/meta/npc-types` | Known npcType values + counts (with `isMonster` flag) |
| GET | `/api/[chronicle]/meta/item-types` | Known item type values + counts |
| GET | `/api/[chronicle]/meta/item-grades` | Known item grade values + counts (Lineage rank order) |

## Response shapes

### Single entity

```json
{
  "data": { "id": 57, "name": "Adena", "...": "..." }
}
```

### List

```json
{
  "data": [ /* up to `limit` entities */ ],
  "meta": {
    "total":  9206,
    "limit":  50,
    "offset": 0
  }
}
```

`meta.total` is the count **after filtering**, before pagination — useful for
"page X of N" UIs.

### Error

```json
{
  "error": "Invalid sort: \"foo\". Allowed: -grade, -id, -name, grade, id, name",
  "status": 400
}
```

| Status | When |
|---|---|
| 200 | Success |
| 400 | Invalid query param (unknown sort, malformed integer, bad enum, etc.) |
| 404 | Unknown chronicle, unknown id, or NPC has no drops |

## List endpoint query params

All list endpoints share `limit`, `offset`, `q`, and `sort`. The rest are
endpoint-specific.

### Common

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | int | 50 | Clamped to `[1, 200]` |
| `offset` | int | 0 | Must be `>= 0` |
| `q` | string | — | Case-insensitive substring match on `name` |
| `sort` | string | source order | See sort sections below |

### `/items` filters

| Param | Allowed values |
|---|---|
| `type` | `weapon`, `armor`, `etcitem` |
| `grade` | `none`, `d`, `c`, `b`, `a`, `s` |

### `/items` sort

Allowed: `id`, `-id`, `name`, `-name`, `grade`, `-grade`

> **Grade ordering is domain-specific.** `sort=grade` follows Lineage rank
> order (`none → d → c → b → a → s`), not alphabetical. `sort=-grade` is the
> reverse.

## Item details

`GET /api/[chronicle]/items/[id]` returns the full item detail. On top of
the base fields (id, name, type, grade, combat stats, weapon/armor
properties), the response carries optional sections that are only emitted
when applicable:

| Section | Present when |
|---|---|
| `skill` | Item has a non-null `itemSkill` reference that resolves |
| `specialAbilityOptions` | Base weapon has at least one SA variant grouped under it |
| `pvpBonus` | Base weapon is A/S-grade **and** has SA variants — encodes the soul-crystal `+5% PvP Damage` engine rule |
| `baseWeaponId` | Item is itself an SA variant; reverse link to its base |
| `crafting` | Item is a recipe scroll |
| `craftedBy` | Item is produced by one or more recipes |
| `partOfSets` | Item is a piece of one or more armor sets — embeds the **full** `ArmorSetDetailDto[]` so consumers can render set context in place |
| `exchangeFrom` | Mammon multisell entries that *produce* this item — present on unsealed A/S armor + accessories. Resolves to `ExchangeOptionDto[]` with NPC, required items, Ancient Adena cost, and the produced item. |
| `exchangeFor` | Mammon multisell entries that *consume* this item as an ingredient — present on sealed A/S armor + accessories. Same shape as `exchangeFrom`, viewed from the ingredient side. |
| `usedAsSpellbook` | Present only when the item is a spellbook. Resolves to a single `SpellbookSkillDto` carrying the taught skill + every class that learns it. |
| `soldBy` | Present when the item is offered for direct adena purchase by any merchant via `buyLists.xml`. Resolves to `ShopOfferDto[]` (sorted by price ascending then NPC id). |
| `rewardOfQuests` | Present when the item is granted as a final quest reward. Adena (57) is never in this list — quest adena lives on the quest's `rewards.adena`. |
| `questItemFor` | Present when the item is registered via a quest's `setItemsIds(...)` (engine-tracked transient items). |

The full field-level contract lives in
[`docs/api-contract.md`](./api-contract.md), mechanically locked by the
snapshot suite at `tests/items.snapshot.test.ts`. The
representative-items list there is the authoritative reference for which
enrichment paths are exercised.

### `/npcs` filters

| Param | Type | Notes |
|---|---|---|
| `levelMin` | int | Inclusive lower bound |
| `levelMax` | int | Inclusive upper bound; must be `>= levelMin` |
| `npcType` | string | Validated against the dataset; case-insensitive |

`/api/[chronicle]/meta/npc-types` returns the full list of valid `npcType`
values for a given chronicle.

### `/npcs` sort

Allowed: `id`, `-id`, `name`, `-name`, `level`, `-level`

NPCs whose `level` is `null` always sort last regardless of direction, so
pagination remains predictable.

### `/monsters` filters and sort

Same shape as `/npcs`, but `monsters` is a **filtered view over the NPC
dataset** — there is no separate generated monsters file. The `npcType` filter
is restricted to the monster subset:

```
Chest, FeedableBeast, FestivalMonster, FriendlyMonster, GrandBoss,
HalishaChest, Monster, PenaltyMonster, RaidBoss, RiftInvader, TamedBeast
```

Passing a non-monster `npcType` (e.g. `Folk`) returns **400**.

Sort options are identical to `/npcs`.

## Cleaned vs raw NPC layer

The NPC dataset is exposed in two parallel layers:

| Layer | Routes | Behavior |
|---|---|---|
| **cleaned** (default) | `/npcs`, `/npcs/[id]`, `/npcs/[id]/drops`, `/npcs/[id]/spawns`, `/monsters`, `/monsters/[id]` | One record per unique name. Drops + spawns aggregated across every merged raw id, deduped on `(category, itemId, min, max, chance)` for drops and on the full position tuple for spawns. `[id]` accepts either the canonical id or any merged raw id. |
| **raw** (`/raw/...`) | `/raw/npcs`, `/raw/npcs/[id]`, `/raw/monsters`, `/raw/monsters/[id]`, `/raw/monsters/[id]/spawns` | Source-faithful. Every raw row preserved. No name dedup, no aggregation. Each row carries `mergedIds=[id]` and `mergedCount=1` for shape uniformity with the cleaned layer. |

Use the cleaned layer for player-facing browsing (no duplicate "Grim Wolf"
rows). Use the raw layer when you need engine-level fidelity — e.g.
debugging spawn or drop differences across NPC variants that share a name.

## Drops endpoints

`GET /api/[chronicle]/drops/npc/[id]` and
`GET /api/[chronicle]/npcs/[id]/drops` currently return the **same enriched
response**. Both routes are kept so that:

- `/drops/npc/[id]` reads naturally as "give me the drops table for NPC N"
- `/npcs/[id]/drops` is the more REST-y nested form

Pick whichever fits your client. Both routes share one implementation.

### Enriched drop entry

```json
{
  "data": {
    "npcId": 22001,
    "npcName": "Grim Wolf",
    "drops": [
      {
        "itemId":   391,
        "itemName": "Puma Skin Shirt",
        "min":      1,
        "max":      1,
        "chance":   166,
        "category": 1,
        "type":     "regular"
      },
      {
        "itemId":   1806,
        "itemName": "Animal Skin",
        "min":      1,
        "max":      2,
        "chance":   250000,
        "category": -1,
        "type":     "spoil"
      },
      {
        "itemId":   57,
        "itemName": "Adena",
        "min":      136,
        "max":      255,
        "chance":   700000,
        "category": 0,
        "type":     "adena"
      }
    ]
  }
}
```

`type` is derived from the source category id:

| `category` | `type` |
|---|---|
| `-1` | `spoil` |
| `0` | `adena` |
| any other | `regular` |

`itemName` is joined from the items dataset at request time and is `null` if
the referenced item id has been removed from the chronicle.

If the requested NPC has no drops table at all, both endpoints return **404**.

### Reverse lookups (`/items/[id]/dropped-by`, `/items/[id]/spoiled-by`)

Given an item id, list every cleaned NPC that drops or spoils it.

- `dropped-by` covers normal drop categories (`category != -1`).
- `spoiled-by` covers spoil entries (`category == -1`).

Identical drop tuples that appear under multiple categories on the same
NPC collapse into one row with a `rollCount` reflecting how many
categories contributed.

```json
{
  "data": [
    {
      "npc": { "id": 22001, "name": "Grim Wolf", "type": "Monster", "level": 19 },
      "entry": { "min": 1, "max": 1, "chance": 166, "category": 1 },
      "rollCount": 1
    }
  ],
  "meta": { "total": 12, "limit": 25, "offset": 0 }
}
```

Both endpoints accept the standard `limit` / `offset` pagination params
(default `limit` is **25**, not 50).

## Spawn endpoints

| Path | Layer | Behavior |
|---|---|---|
| `/api/[chronicle]/npcs/[id]/spawns` | cleaned | Aggregated across merged ids; deduped on full position tuple |
| `/api/[chronicle]/raw/monsters/[id]/spawns` | raw | Source-faithful, single id, no aggregation |

Both return `{ data: Spawn[] }`. An NPC that exists but has no
`spawnlist` rows returns **200** with an empty array; **404** is reserved
for unknown ids.

```json
{
  "data": [
    {
      "npcId":         22001,
      "x":             12345,
      "y":             -67890,
      "z":             -3500,
      "heading":       16384,
      "respawnDelay":  60,
      "respawnRandom": 0,
      "periodOfDay":   0
    }
  ]
}
```

## Classes

`GET /api/[chronicle]/classes` returns every player class in one
response (89 on Interlude — 9 base, 18 1st-profession, 31 2nd-profession,
31 3rd-profession). `GET /api/[chronicle]/classes/[id]` returns a
single class with its full skill-learn table and parent/child links.

```json
{
  "data": [
    { "id": 0,  "name": "Human Fighter",   "race": "Human", "type": "Fighter", "professionLevel": 0, "parentClassId": null },
    { "id": 1,  "name": "Warrior",         "race": "Human", "type": "Fighter", "professionLevel": 1, "parentClassId": 0 },
    { "id": 90, "name": "Phoenix Knight",  "race": "Human", "type": "Fighter", "professionLevel": 3, "parentClassId": 5 },
    "..."
  ],
  "meta": { "total": 89, "limit": 89, "offset": 0 }
}
```

Class-detail responses add `childClassIds: number[]` and
`skills: ClassSkillLearnDto[]`. Each skill row carries `name` and
`iconFile` resolved straight from `skills.json` — no separate icon
parser. When the skill requires a spellbook, `spellbookItemId` points
at the required item.

```json
{
  "data": {
    "id": 0,
    "name": "Human Fighter",
    "race": "Human",
    "type": "Fighter",
    "professionLevel": 0,
    "parentClassId": null,
    "childClassIds": [1, 4, 7],
    "skills": [
      { "skillId": 3, "skillLevel": 1, "name": "Power Strike", "iconFile": "skill0003.png", "minPlayerLevel": 5, "spCost": 50 },
      "..."
    ]
  }
}
```

The reverse direction (skill → classes that learn it) lives on items
that are spellbooks via `ItemDetailDto.usedAsSpellbook` — see the
item-details section above.

## Armor sets

`GET /api/[chronicle]/armor-sets` returns the full armor-set catalog in
one response — every set with its pieces, set bonus skill, and any
shield / enchant-6 bonuses, all resolved up front so consumers don't
need a second round-trip.

There is no `/armor-sets/[id]` detail endpoint by design. Each set is
also reachable from any of its pieces via `ItemDetailDto.partOfSets[]`
— the embedded shape is identical to one entry of `data[]` here.

```json
{
  "data": [
    {
      "id": 1,
      "name": "Wooden Set",
      "pieces": {
        "chest": { "itemId": 23,   "name": "Wooden Breastplate", "iconFile": "armor_t06_u_i00.png" },
        "legs":  { "itemId": 2386, "name": "Wooden Gaiters",     "iconFile": "armor_t06_l_i00.png" },
        "head":  { "itemId": 43,   "name": "Wooden Helmet",      "iconFile": "armor_leather_helmet_i00.png" }
      },
      "bonusSkill": {
        "id": 3500, "level": 1, "name": "Wooden Set",
        "description": "Increases P. Def. and Max HP.",
        "effects": [
          { "op": "mul", "stat": "pDef",  "value": 1.02 },
          { "op": "add", "stat": "maxHp", "value": 41 }
        ],
        "...": "..."
      }
    },
    "..."
  ],
  "meta": { "total": 51, "limit": 51, "offset": 0 }
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | int | Synthetic position-based id (1..N over `armorSets.xml`). Stable while the source XML ordering is stable. |
| `name` | string | Set name. **Not unique** — `"Mithril Robe Set"` collides; use `id` to disambiguate. |
| `pieces` | object | `{ chest, legs?, head?, gloves?, feet? }`. `chest` is always present; other slots only when required. |
| `bonusSkill` | object \| null | Main set bonus, fully resolved with `description` + parsed `effects[]`. |
| `shield` | object | Present only when the set has a shield slot. Carries the shield piece + its own bonus skill. |
| `enchant6BonusSkill` | object \| null | Present only when the set carries an enchant-6 bonus. |

**No query params today.** Pagination, search, and sort are deferred until
a consistent design lands across all list endpoints. The full catalog
(51 sets on Interlude) ships in a single response.

## Meta endpoints

Meta endpoints are introspection helpers for building filter UIs. All values
are computed from the actual generated dataset, not hardcoded.

### `GET /api/[chronicle]/meta/npc-types`

```json
{
  "data": [
    { "name": "Adventurer", "isMonster": false, "count": 77 },
    { "name": "GrandBoss",  "isMonster": true,  "count": 15 },
    { "name": "Monster",    "isMonster": true,  "count": 2541 }
  ]
}
```

Sorted alphabetically by `name`. `isMonster` shares its source of truth with
`/monsters` and `/monsters/[id]`, so `isMonster: true` ⇔ valid `npcType` filter
on `/monsters`.

### `GET /api/[chronicle]/meta/item-types`

```json
{
  "data": [
    { "name": "armor",   "count": 1125 },
    { "name": "etcitem", "count": 6864 },
    { "name": "weapon",  "count": 1217 }
  ]
}
```

Sorted alphabetically.

### `GET /api/[chronicle]/meta/item-grades`

```json
{
  "data": [
    { "name": "none", "count": 7335 },
    { "name": "d",    "count": 318 },
    { "name": "c",    "count": 504 },
    { "name": "b",    "count": 506 },
    { "name": "a",    "count": 409 },
    { "name": "s",    "count": 134 }
  ]
}
```

Returned in **Lineage grade rank order** (`none → d → c → b → a → s`), not
alphabetical, so the response can be used directly in a filter dropdown.

## Examples

```http
# Single item
GET /api/interlude/items/57

# A-grade weapons, alphabetical, first page
GET /api/interlude/items?type=weapon&grade=a&sort=name&limit=10

# All Folk-type NPCs, alphabetical
GET /api/interlude/npcs?npcType=Folk&sort=name

# Top 5 RaidBosses by level (descending)
GET /api/interlude/monsters?npcType=RaidBoss&sort=-level&limit=5

# Drops for an NPC (REST-style)
GET /api/interlude/npcs/22001/drops

# Drops for an NPC (alternate path, identical response)
GET /api/interlude/drops/npc/22001

# Item detail with Mammon exchange (Tallum Plate Armor: produced by unsealing)
GET /api/interlude/items/2382

# Item detail with Mammon exchange (Sealed Tallum Plate Armor: consumed when unsealing)
GET /api/interlude/items/5293

# Reverse lookup: NPCs that drop a given item
GET /api/interlude/items/391/dropped-by

# Reverse lookup: NPCs that spoil a given item
GET /api/interlude/items/1806/spoiled-by

# Spawn coordinates for a cleaned NPC
GET /api/interlude/npcs/22001/spawns

# Merchant shop view (buyList products + curated exchanges)
GET /api/interlude/npcs/30001/shop

# Raw NPC list — source-faithful, no name dedup
GET /api/interlude/raw/npcs?levelMin=20&levelMax=25

# Full armor-set catalog (rich, all 51 sets in one response)
GET /api/interlude/armor-sets

# Full region catalog (19 named map regions on Interlude)
GET /api/interlude/regions

# Full quest catalog (329 on Interlude)
GET /api/interlude/quests

# Single quest detail (Q001 Letters of Love)
GET /api/interlude/quests/1

# All player classes (89 on Interlude)
GET /api/interlude/classes

# Single class with skill-learn table (Human Fighter)
GET /api/interlude/classes/0

# Filter dropdowns: known npc types
GET /api/interlude/meta/npc-types

# Filter dropdowns: item grades in rank order
GET /api/interlude/meta/item-grades
```

## Behavior notes

- **Unknown chronicle** → 404.
- **Invalid query param** (bad sort, bad enum, malformed int, `levelMin > levelMax`) → 400 with a clear error message that lists the allowed values when applicable.
- **Empty optional query params** (`?sort=`, `?npcType=`, `?q=`) are treated as absent — same as omitting them.
- **`limit` is clamped** to a maximum of 200; values above are silently capped (no error).
- **Order of operations** for list endpoints: filter → sort → paginate. `meta.total` reports the count after filtering and before pagination.
- **Sort tie-breaking** is deterministic: when two rows tie on the primary sort field, they fall back to `id` ascending — always ascending, regardless of whether the primary direction is `asc` or `desc`. This makes pagination overlap-free and stable across requests.
- **`monsters` is not a generated dataset.** It's a filtered view over the
  loaded NPC index. The monster type set is the single source of truth for
  `/monsters`, `/monsters/[id]`, and `meta/npc-types#isMonster`.
- **Caching:** datasets are loaded from disk once per chronicle on first
  request and cached in memory; ID lookups, list filters, and meta summaries
  all read from the cached indexes.
- **Response headers:** all routes set `Cache-Control: public, max-age=86400`.

## Related documents

- [`api-contract.md`](./api-contract.md) — DTO field-level stability
  contract: which fields are stable, normalization / rounding rules,
  and the snapshot suite that mechanically locks them.
- [`README.md`](../README.md) — project overview, build/run instructions,
  and how to add a new chronicle.

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

| Method | Path | Description |
|---|---|---|
| GET | `/api/[chronicle]/items` | List items (filter, sort, paginate) |
| GET | `/api/[chronicle]/items/[id]` | Single item by id |
| GET | `/api/[chronicle]/npcs` | List NPCs (filter, sort, paginate) |
| GET | `/api/[chronicle]/npcs/[id]` | Single NPC by id |
| GET | `/api/[chronicle]/npcs/[id]/drops` | Enriched drops for an NPC (REST style) |
| GET | `/api/[chronicle]/monsters` | List monsters (filtered NPC subset) |
| GET | `/api/[chronicle]/monsters/[id]` | Single monster by id |
| GET | `/api/[chronicle]/drops/npc/[id]` | Enriched drops for an NPC (alternate path) |
| GET | `/api/[chronicle]/meta/npc-types` | Known npcType values + counts |
| GET | `/api/[chronicle]/meta/item-types` | Known item type values + counts |
| GET | `/api/[chronicle]/meta/item-grades` | Known item grade values + counts |

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

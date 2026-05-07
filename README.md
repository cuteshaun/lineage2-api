# Lineage 2 API

A read-only HTTP API over Lineage 2 game data — items, NPCs, monsters,
drops, spawns, quests, classes, hennas, locations, and more.

## Overview

The API is generated from an aCis Interlude datapack and a small set of
Lineage 2 client DAT files. There is no database and no XML/DAT parsing
at runtime: a build step turns the upstream sources into JSON, and the
runtime serves DTOs over those files.

Every route is chronicle-aware and lives under `/api/[chronicle]/...`,
so additional chronicles can be added without changing endpoints.

## Status

| | |
|---|---|
| Supported chronicle | `interlude` |
| Source data | aCis Interlude datapack + selected client DAT files |
| Storage | generated JSON on disk (no database) |
| Stability | pre-v1 — public response shapes are locked by snapshot tests |
| OpenAPI | served at `/api/openapi.json` |
| License | MIT |

## Getting started

```bash
pnpm install
pnpm build:data            # parse sources → data/generated/interlude/
pnpm dev                   # http://localhost:3000
```

For production:

```bash
pnpm build && pnpm start
```

The aCis datapack is not redistributed here. Point `scripts/chronicle-sources.ts`
at a local checkout before running `pnpm build:data`.

## Quick examples

```bash
# Item — Adena
curl http://localhost:3000/api/interlude/items/57

# Item — a henna dye, with embedded henna mechanics
curl http://localhost:3000/api/interlude/items/4445

# Monster — Queen Ant
curl http://localhost:3000/api/interlude/monsters/29001

# Quest
curl http://localhost:3000/api/interlude/quests/1

# Player class — Warrior
curl http://localhost:3000/api/interlude/classes/2

# Player-facing hunting locations catalog
curl http://localhost:3000/api/interlude/locations

# Machine-readable contract
curl http://localhost:3000/api/openapi.json
```

List endpoints accept `limit`, `offset`, `q`, and entity-specific filters
(`type`, `grade`, `npcType`, level ranges) plus `sort`. See
[docs/api.md](docs/api.md) for the full grammar.

## API surface

| Group | Routes |
|---|---|
| Items | `/items`, `/items/[id]` |
| NPCs | `/npcs`, `/npcs/[id]`, `/npcs/[id]/drops`, `/npcs/[id]/spawns`, `/npcs/[id]/shop` |
| Monsters | `/monsters`, `/monsters/[id]` (filtered NPC view) |
| Quests | `/quests`, `/quests/[id]` |
| Classes | `/classes`, `/classes/[id]` |
| Hennas | `/hennas`, `/hennas/[symbolId]` |
| Regions | `/regions` (engine death-teleport regions) |
| Locations | `/locations` (player-facing hunting zones) |
| Armor sets | `/armor-sets` |
| Recipes | `/recipes` |
| Meta | `/meta/item-types`, `/meta/item-grades`, `/meta/npc-types` |
| Spec | `/api/openapi.json` |

Item, NPC, and quest detail responses cross-link aggressively — items
carry `droppedBy`, `spoiledBy`, `rewardedByQuests`, `craftedBy`,
`partOfSets`, `soldBy`, `henna`; NPCs carry `startsQuests`,
`involvedInQuests`, `primaryRegion?`, `primaryLocation?`; classes carry
their full skill-learn table and allowed hennas. The full list lives in
[docs/api.md](docs/api.md).

## Public vs raw endpoints

The API exposes two layers, side by side:

- **Public** (`/api/[chronicle]/...`) — cleaned, deduped, cross-linked.
  Snapshot-locked. NPCs are merged on display name, drops are deduped
  across merged ids, locations / regions / quest journal entries are
  resolved into compact refs. This is the layer you want for tools and
  UIs.
- **Raw** (`/api/[chronicle]/raw/...`) — source-faithful. One row per
  upstream record, no merging, no enrichment. Useful when you need to
  audit the original engine data or compare against another datapack.

Raw routes never gain enrichment fields, and public routes never lose
them — that boundary is part of the contract.

## Data sources and limitations

- **aCis Interlude datapack** — items, NPCs, drops, spawns, quests,
  classes, recipes, armor sets, multisells, buylists, hennas, regions.
- **L2 client DAT files** — display names, icons, journal entries,
  hunting-zone anchors. Optional per chronicle; missing DATs surface as
  `null` on the affected fields rather than silently filled.
- Differences against L2Hub, PTS, or other databases are
  source/reference differences, not parser bugs.
- Hunting-zone resolution is **nearest 2D anchor within 10000 game
  units**, not polygon containment — `huntingzone-e.dat` carries center
  anchors only. A small audit-justified override map handles known
  failures (e.g. Queen Ant → *The Ant Nest*) on NPC and monster detail.
- Spell effects, AI scripts, geodata, and runtime engine behaviour are
  out of scope.

## Documentation

- [docs/api.md](docs/api.md) — full route reference: paths, query
  params, sort options, response shapes, examples.
- [docs/api-contract.md](docs/api-contract.md) — DTO field-level
  stability contract, the null-vs-absent policy, and the public/raw
  boundary.
- `/api/openapi.json` — machine-readable spec, generated from the same
  Zod schemas the typecheck uses.

## Disclaimer

Unofficial fan project. Not affiliated with, endorsed by, or sponsored
by NCSoft. *Lineage* and *Lineage II* are trademarks of their respective
owners. This repository ships no game client or datapack content; you
supply your own copy of the upstream sources.

## License

[MIT](LICENSE) © Lineage 2 API contributors

# Lineage 2 API

A read-only HTTP API over Lineage 2 datapack content (items, NPCs, drop
tables), built with Next.js (App Router) and served from generated JSON.
Chronicle is part of every URL path so additional chronicles can be added in
the future without endpoint changes.

> **Status**
>
> | | |
> |---|---|
> | Currently supported chronicle | **Interlude** |
> | Backing dataset | aCis Interlude datapack XML |
> | Chronicle-aware architecture | yes — designed to host more chronicles later |
> | Additional chronicles | planned, not yet implemented |
> | API stability | early — response shapes may still evolve |
>
> Unofficial project. Not affiliated with or endorsed by NCSoft. Lineage and
> Lineage 2 are trademarks of their respective owners.

## What's in the box

- Items, NPCs, and NPC drop tables exposed as JSON
- Filtering, sorting, pagination
- Introspection endpoints for filter dropdowns (npc types, item types, item grades)
- Single in-memory cache per chronicle, built on first request
- One file per chronicle for manual data fixes

See [docs/api.md](docs/api.md) for the full API reference.

## Project layout

```
data/
  datapack/<chronicle>/         # placeholder for upstream XML (untracked)
  manual-fixes/<chronicle>.json # one file per chronicle, sectioned by entity
  generated/<chronicle>/        # build output: items.json, npcs.json, drops.json
scripts/
  parse-items.ts                # XML → items.json
  parse-npcs.ts                 # XML → npcs.json
  parse-drops.ts                # XML → drops.json (joined to npcs/items)
  build-data.ts                 # runs all three in order
  chronicle-sources.ts          # build-only XML source paths
src/
  lib/chronicles.ts             # supported chronicle registry
  lib/chronicle-config.ts       # runtime data paths
  lib/data/loaders.ts           # cached JSON loaders
  lib/data/indexes.ts           # in-memory ID maps + filter/sort logic
  lib/api/responses.ts          # shared route helpers (pagination, validation)
  lib/api/drops.ts              # shared enriched-drops helper
  app/api/[chronicle]/...       # route handlers
docs/
  api.md                        # API reference (start here)
```

## Build the dataset

```bash
pnpm install
pnpm build:data                       # defaults to interlude
pnpm build:data --chronicle=interlude # explicit
```

This reads upstream XML and writes
`data/generated/<chronicle>/{items,npcs,drops}.json`. The XML source path
lives in [scripts/chronicle-sources.ts](scripts/chronicle-sources.ts).

You will need a local copy of the upstream datapack referenced there. The
datapack itself is not redistributed in this repo.

## Run the API

```bash
pnpm dev                  # development
pnpm build && pnpm start  # production
```

The API is mounted at `/api/[chronicle]/...`. See
**[docs/api.md](docs/api.md)** for the full reference: endpoints, query
params, sort options, response shapes, and examples.

## Quick examples

```bash
curl http://localhost:3000/api/interlude/items/57
curl 'http://localhost:3000/api/interlude/items?type=weapon&grade=a&sort=name&limit=10'
curl 'http://localhost:3000/api/interlude/monsters?npcType=GrandBoss&sort=-level'
curl http://localhost:3000/api/interlude/npcs/22001/drops
curl http://localhost:3000/api/interlude/meta/npc-types
```

## Adding a new chronicle later

1. Add the chronicle to `SUPPORTED_CHRONICLES` in [src/lib/chronicles.ts](src/lib/chronicles.ts).
2. Add a runtime data spec in [src/lib/chronicle-config.ts](src/lib/chronicle-config.ts).
3. Add a build-only XML source spec in [scripts/chronicle-sources.ts](scripts/chronicle-sources.ts).
4. Create `data/manual-fixes/<chronicle>.json` with `{ "items": {}, "npcs": {}, "drops": {} }`.
5. Run `pnpm build:data --chronicle=<chronicle>`.

No route, loader, parser, or API change is required — every endpoint becomes
available at `/api/<chronicle>/...` automatically.

## License

[MIT](LICENSE) © Lineage 2 API contributors

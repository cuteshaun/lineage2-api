# Lineage 2 API

A read-only HTTP API over Lineage 2 datapack content — items, NPCs, drops,
spawns, recipes, skills, and armor sets — built with Next.js (App Router)
and served from generated JSON. Chronicle is part of every URL path so
additional chronicles can be added without endpoint changes.

> **Status**
>
> | | |
> |---|---|
> | Currently supported chronicle | **Interlude** |
> | Backing data | aCis Interlude datapack XML |
> | Chronicle-aware architecture | yes — designed for more chronicles later |
> | API stability | early — response shapes may still evolve |
>
> Unofficial project. Not affiliated with or endorsed by NCSoft. Lineage
> and Lineage 2 are trademarks of their respective owners.

## What's in the box

- **Items** — full detail with combat stats, weapon/armor properties,
  resolved item skill (description + parsed effects), and Special Ability
  (SA) variants for A/S-grade weapons including the `+5% PvP Damage`
  engine rule.
- **NPCs** — both a **cleaned** layer (one record per unique name,
  drops + spawns aggregated across merged ids) and a **raw**, source-faithful
  layer for callers who need engine-level fidelity.
- **Monsters** — filtered view over the NPC dataset.
- **Drops** — enriched with item names, deduped on `(npcId, itemId, min,
  max, chance)`, and reverse-indexed: every item carries `dropped-by` and
  `spoiled-by` lookups.
- **Spawns** — coordinates per NPC, deduped across merged ids.
- **Recipes** — exposed inline on item-detail responses (`crafting` for
  recipe scrolls, `craftedBy` for products).
- **Armor sets** — full catalog endpoint plus embedded set context on
  every piece (`partOfSets[]`).
- **Meta endpoints** — known npc types / item types / item grades, with
  counts, for filter dropdowns.

## Where things live

| | |
|---|---|
| `data/datapack/<chronicle>/` | placeholder for upstream XML (untracked) |
| `data/manual-fixes/<chronicle>.json` | one file per chronicle, sectioned by entity |
| `data/generated/<chronicle>/` | build output — `items`, `npcs`, `drops`, `spawns`, `recipes`, `skills`, `armor-sets` JSON |
| `scripts/` | `parse-*.ts` per entity, plus `build-data.ts` orchestrator |
| `src/lib/data/` | cached JSON loaders + in-memory indexes |
| `src/lib/api/` | shared route helpers + DTO layer |
| `src/app/api/[chronicle]/...` | route handlers |
| `docs/api.md` | full API reference — start here |
| `docs/api-contract.md` | DTO field-level stability contract |

## Build the dataset

```bash
pnpm install
pnpm build:data                       # defaults to interlude
pnpm build:data --chronicle=interlude # explicit
```

This reads upstream XML and writes
`data/generated/<chronicle>/*.json`. The XML source path lives in
[scripts/chronicle-sources.ts](scripts/chronicle-sources.ts). The datapack
itself is not redistributed in this repo — you need a local checkout.

## Run the API

```bash
pnpm dev                  # development
pnpm build && pnpm start  # production
```

Mounted at `/api/[chronicle]/...`. See **[docs/api.md](docs/api.md)** for
the full reference: endpoints, query params, sort options, response
shapes, and examples.

## Quick examples

```bash
curl http://localhost:3000/api/interlude/items/57
curl 'http://localhost:3000/api/interlude/items?type=weapon&grade=a&sort=name&limit=10'
curl 'http://localhost:3000/api/interlude/monsters?npcType=GrandBoss&sort=-level'
curl http://localhost:3000/api/interlude/npcs/22001/drops
curl http://localhost:3000/api/interlude/armor-sets
curl http://localhost:3000/api/interlude/meta/item-grades
```

## Adding a new chronicle

1. Register it in [src/lib/chronicles.ts](src/lib/chronicles.ts) and add a
   runtime data spec in [src/lib/chronicle-config.ts](src/lib/chronicle-config.ts).
2. Add a build-only XML source spec in [scripts/chronicle-sources.ts](scripts/chronicle-sources.ts).
3. Create `data/manual-fixes/<chronicle>.json` with sections for each entity.
4. Run `pnpm build:data --chronicle=<chronicle>`.

No route, loader, parser, or API change is required — every endpoint
becomes available at `/api/<chronicle>/...` automatically.

## License

[MIT](LICENSE) © Lineage 2 API contributors

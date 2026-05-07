# Lineage 2 API

A read-only HTTP API over Lineage 2 game data — items, NPCs, drops,
spawns, quests, classes, hennas, and locations.

Generated from an aCis Interlude datapack and a small set of Lineage 2
client DAT files. No database, no runtime parsing — a build step turns
the upstream sources into JSON, and the runtime serves DTOs over those
files.

| | |
|---|---|
| Supported chronicle | `interlude` |
| Storage | generated JSON on disk |
| Stability | pre-v1 — response shapes locked by snapshot tests |
| OpenAPI | `/api/openapi.json` |
| License | MIT |

## Getting started

```bash
pnpm install
pnpm dev                   # http://localhost:3000
```

The generated JSON dataset (`data/generated/interlude/`) is committed
to the repo, so a fresh clone runs the full API and test suite without
a local datapack. Regenerate the dataset only when parsers change:

```bash
pnpm build:data            # rewrites data/generated/interlude/*.json
```

`pnpm build:data` reads from a local aCis datapack and (optionally) L2
client DAT files configured in `scripts/chronicle-sources.ts`; neither
the datapack nor the DAT files are redistributed here. The resulting
JSON diff is reviewed in PR alongside any parser change — the dataset
is the source-of-truth artefact the API actually serves.

## Examples

```bash
curl http://localhost:3000/api/interlude/items/57          # Item: Adena
curl http://localhost:3000/api/interlude/monsters/29001    # Monster: Queen Ant
curl http://localhost:3000/api/interlude/quests/1          # Quest: Letters of Love
curl http://localhost:3000/api/interlude/classes/2         # Class: Gladiator
curl http://localhost:3000/api/interlude/locations         # Location catalog
curl http://localhost:3000/api/openapi.json                # OpenAPI schema
```

Every game-data route lives under `/api/[chronicle]/...`. List endpoints
use a `data` + `meta` envelope and support pagination or filters where
applicable. Detail responses are cross-linked: items carry their drop
sources, recipes, shops, quest rewards, and set membership; NPCs carry
their drops, spawns, and quests.

## Public vs raw

Two layers, side by side:

- **Public** (`/api/[chronicle]/...`) — cleaned, deduped, cross-linked.
  Snapshot-locked. The layer you want for tools and UIs.
- **Raw** (`/api/[chronicle]/raw/...`) — source-faithful, one row per
  upstream record. For auditing the original engine data.

Raw routes stay close to source data. Public routes are allowed to enrich,
dedupe, normalize, and cross-link records for consumers.

## Documentation

- [API reference](docs/api.md)
- [API contract](docs/api-contract.md)
- OpenAPI: `/api/openapi.json`
Deployment notes live in [docs/deployment.md](docs/deployment.md).

## Limitations

- Hunting-zone resolution is nearest 2D anchor within a fixed threshold,
  not polygon containment. A small override map handles known failures.
- Some display fields can be `null` when the corresponding client DAT data
  is unavailable or unresolved.
- Data follows the bundled aCis Interlude sources. Other databases may
  differ because they use different datapacks, formula layers, or runtime
  computations.
- Full skill-effect simulation, AI scripts, geodata, and runtime engine
  behaviour are out of scope.
- List endpoints paginate at default 50, max 200 per page. Catalogs and
  detail relations return single-page responses bounded by source data.
- Successful responses are CDN-cacheable; errors return `no-store`.
  Production deployments are expected to enforce per-IP rate limits at
  the platform layer.

## Disclaimer

Unofficial fan project. Not affiliated with NCSoft. *Lineage* and
*Lineage II* are trademarks of their respective owners. This repository
ships no game client or datapack content.


## License

[MIT](LICENSE)

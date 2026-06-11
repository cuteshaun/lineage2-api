# Lineage 2 API

A public, read-only HTTP API for **Lineage 2 Interlude** game data — items, NPCs, monsters, drops, spoil, spawns, quests, classes, armor sets, hennas, locations and more.

## Links

* Website: https://l2api.dev
* API docs: https://docs.l2api.dev
* What you can build (l2 wiki example): https://explorer.l2api.dev
* OpenAPI: https://l2api.dev/api/openapi.json

## Quick example

```bash
curl https://l2api.dev/api/interlude/items/57
```

## Local development

Requires Node.js 20+.

Run the API and landing page:
```bash
pnpm install
pnpm dev
```

Run the docs site:

```bash
pnpm run dev:docs
```

Local API:

```txt
http://localhost:3000/api/interlude
```

The generated dataset is committed under `data/generated/interlude/`, so a fresh clone can run without a local datapack.

Regenerate data only when parsers change:

```bash
pnpm build:data
```

## Disclaimer

Community project. Not affiliated with NCSoft.

## License

[MIT](LICENSE)

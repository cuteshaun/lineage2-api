# Project Context: Lineage 2 API

## Overview

This is a public, read-only community API for Lineage 2 Interlude.

The architecture is chronicle-aware and designed to support additional chronicles in the future.

The project is unofficial and not affiliated with NCSoft.

The API, landing page, and documentation site are deployed in production on Vercel.

---

## Current Production Status

- The API is live in production.
- The landing page is live in production.
- The documentation site (Astro / Starlight) is live in production.
- The knowledge base / explorer example is live in production as a separate repo.

Three production-facing surfaces:

1. **API + landing** — this repo (`main`)
2. **Astro / Starlight docs** — `apps/docs/` in this repo
3. **Knowledge base / explorer example** — a separate repo, deployed independently

The API remains the source of truth. The landing, docs, and knowledge base are adoption and distribution surfaces; they consume the public API contract, they do not redefine it.

Public API contract is frozen unless a release-blocking issue is found.

### Still in progress

- Desktop design for the public-facing surfaces is mostly done.
- Mobile design is not finished.
- SEO is incomplete: metadata, titles, descriptions, Open Graph tags, favicon, and social-preview images.
- Documentation exists but is still raw and needs more real examples.
- Analytics are not installed yet.

---

## Repository Layout

### main (this repo)

`main` ships the backend API, the public landing page, and the documentation site.

It is the canonical source for:

- data parsing
- generated JSON output
- public API routes
- raw API routes
- DTO mapping
- API contract documentation
- snapshot tests
- build-time enrichment
- the public landing page (`src/app/page.tsx`, `src/app/about/page.tsx`)
- the Starlight docs site (`apps/docs/`)

`main` is what's deployed at the public API + landing URL and at the docs subdomain.

Do not add database-explorer UI, user-facing wiki pages, comments, ratings, screenshots, or community features to this repo. Those belong in the separate knowledge-base / explorer repo described below.

### Knowledge base / explorer (separate repo)

A reference client and visual sandbox for the public API now lives in **its own deployed repo**, not in this one. The old `ui-explorer` branch has been moved out and is no longer the primary location for explorer work.

The knowledge base / explorer exists to:

- dogfood the public API endpoints
- expose missing or awkward API relations
- demonstrate real player-facing use cases
- inform API improvements via real consumer feedback

The knowledge base / explorer must not become the source of truth. The API is the source of truth.

If the explorer needs heavy client-side workarounds, first consider whether the DTO should be improved in this repo. Any API change motivated by explorer use should remain useful to other external consumers (see *API Changes from External Clients* below).

---

## Data Source & Build Model

- Data is parsed from aCis datapack XML files
- Selected client DAT metadata may be parsed at build time when it adds clear public value
- Data is generated during build (`scripts/build-data.ts`)
- Output is stored as JSON under `data/generated/{chronicle}`
- The API reads from generated JSON at runtime
- No direct XML or DAT parsing in production

Generated files under `data/generated/{chronicle}` must not be hand-edited. Fix parsers, build scripts, DTO mapping, or UI consumption instead.

---

## Product Philosophy

Public endpoints must be:

- clean
- deduplicated
- stable
- player-friendly

Raw endpoints must:

- preserve original data structure
- stay close to engine truth

Prefer:

- additive changes
- backward compatibility
- minimal abstraction

---

## Current Data Model

The API ships the following domains (v1 release candidate; public API contract is frozen unless a release-blocking issue is found):

- Items
- NPCs / Monsters (cleaned + raw layers)
- Drops and Spoil, both directions
- Spawns (cleaned, with region + location enrichment; raw stays unenriched)
- Recipes
- Skills
- Armor sets
- Classes (with skill-learn tables and spellbook refs)
- Spellbooks (forward + reverse links between item ↔ skill ↔ class)
- Shops: merchant `buyLists`, curated multisells, NPC `/shop` view
- Quests (with optional client journal entries from `questname-e.dat`)
- Regions (engine death-teleport regions from `mapRegions.xml`)
- Locations (player-facing hunting zones from `huntingzone-e.dat`)
- Hennas (joined from `hennas.xml` + `hennagrp-e.dat`)
- OpenAPI spec at `/api/openapi.json` (chronicle-agnostic)

### Key Decisions

- NPC canonical identity uses:
  - `(name, level)`

- Drop system:
  - exact duplicates collapsed via `rollCount`
  - Adena (`itemId=57`) always has `type="adena"`
  - sorted for readability, not raw category order
  - reward cross-link `rewardedByQuests` carries per-quest counts;
    Adena rewards surfaced via `q.rewards.adena` scalar (not `items[]`)

- Skills:
  - primarily parsed from aCis XML
  - indexed by `"id-level"`
  - enriched at build time with selected client metadata when useful
  - may include `description: string | null` when available
  - `itemSkill` is resolved into DTO summaries

- `ItemDetailDto` shape:
  - common fields stay top-level (`id`, `name`, `weight`, `price`,
    `material`, `iconFile`)
  - type-specific fields are grouped: `category?`, `stats?`, `shots?`,
    `timing?`, `flags?`, `crystal?`
  - groups are omitted entirely when no inner key applies
  - `null` is reserved for the four always-emitted top-level fields;
    everything else is omit-when-absent

- `NpcDetailDto` / `MonsterDetailDto` shape:
  - vitals + reward + combat + movement live under `stats`
  - six base attributes (str/dex/con/int/wit/men) live under `baseStats`
  - AI fields (`aggroRange`, optional `assistRange`) live under
    optional `behavior?`; the group is omitted entirely on the few
    NPCs without an `<ai>` block
  - `isAggressive` stays top-level for parity with `NpcListDto`
  - `skills[]` is always emitted; `title`/`race`/etc. are omitted when
    the source value is null

- Quests:
  - `QuestDetailDto` does not surface `scriptFile` (Java path is an
    implementation detail)
  - `questItems[]` uses `QuestItemRefDto` with no `count` — engine list
    registers item ids only; a placeholder count would be a lie
  - `rewards.adena?` / `exp?` / `sp?` are optional; absent ≠ zero
  - `clientJournalEntries?` is the in-game quest log text, not a
    mechanically-derived walkthrough; trailing `\n` markers are
    trimmed at the DTO layer, internal markers preserved verbatim

- Hennas:
  - mechanics fields (`statChanges`, `engravePrice`, `dyeItem`,
    `allowedClassIds`) always populated from `hennas.xml`
  - `engravePrice` (not `price`) is the Symbol Maker's engrave cost,
    distinct from the dye item's own vendor `ItemDetailDto.price`
  - display fields (`displayName`, `iconFile`, `shortLabel`) are
    honestly `null` for the 9 Greater II symbols (172–180) whose DAT
    record uses an unsupported shared-prefix encoding

- Locations:
  - resolved by 2D nearest-anchor with a 10000-unit threshold, not
    polygon containment (`huntingzone-e.dat` carries center anchors
    only)
  - public DTO normalizes whitespace (trim + collapse internal runs);
    raw endpoints surface source spelling
  - a small audit-justified override map (`PRIMARY_LOCATION_OVERRIDES_BY_NPC_ID`
    in `src/lib/api/dto/location.ts`) applies only to NPC / Monster
    detail's `primaryLocation?` for verified heuristic failures
    (current entry: NPC 29001 Queen Ant → zone 34 The Ant Nest);
    every other surface uses the unmodified resolver

- NPC skill presentation:
  - public responses may separate clearly derived fields from raw engine-like entries
  - race may be exposed as a first-class field when reliably derivable
  - UI/DTO cleanup is preferred before changing core generated data

- Armor sets:
  - exposed via a single rich catalog endpoint (`GET /api/[chronicle]/armor-sets`)
  - the same per-set shape is embedded into every piece's `ItemDetailDto.partOfSets[]`
  - no separate per-id detail endpoint by design

- Cache-Control contract:
  - successful responses use
    `public, max-age=300, s-maxage=86400, stale-while-revalidate=604800`
  - error responses (`400` / `404` / `5xx`) use `Cache-Control: no-store`
  - this is part of the v1 contract; clients must not assume errors are cacheable

---

## API Design Principles

- Public API contract is documented in `docs/api-contract.md`
- Public API contract is mechanically locked by snapshot tests under `tests/*.snapshot.test.ts`
- Any change to a stable DTO field must update both docs and snapshots
- Public API is not the same thing as raw engine data

The DTO layer is allowed to:

- deduplicate
- normalize
- reshape data
- enrich with already-generated metadata

Raw data must remain unchanged unless explicitly requested.

Prefer solving problems in:

- DTO layer
- or UI layer

before changing core generated data models.

Removing or renaming public DTO fields is a breaking change. Prefer adding optional fields over changing existing response shapes.

---

## Knowledge Base / Explorer Guidelines

These guidelines apply to the knowledge base / explorer in its separate repo, and to any future API-consuming client built on the public Lineage 2 API.

- Keep the client lightweight and API-driven
- Prefer simple, readable UI over complex app architecture
- Do not duplicate API business logic in the client unless necessary
- Hide empty sections instead of rendering placeholder noise
- Use DTO fields as-is when possible
- If a page requires many extra client-side joins, consider improving the API response in this repo
- Treat icons, screenshots, and visual polish as progressive enhancements
- The explorer should validate real player-facing use cases, not invent abstract API needs

A knowledge base or explorer is allowed to be more player-friendly and wiki-like than the API, but it must not become the source of truth.

---

## API Changes from External Clients

API changes discovered while building external clients (e.g., the knowledge base / explorer in its separate repo) are allowed when they improve real use cases, but they should remain:

- additive
- backward-compatible
- documented
- covered by snapshots
- useful beyond a single client

Before adding a new endpoint, check whether the existing item, NPC, monster, skill, recipe, or raw endpoints already expose enough data.

Do not create overly specific endpoints for one UI block unless the relation is broadly useful to external consumers.

---

## Engineering Guidelines

- Keep changes minimal and reversible
- Follow existing project structure
- Avoid speculative abstractions
- Validate using real Lineage 2 examples
- Preserve existing response shapes and pagination
- Prefer build-time enrichment over runtime filesystem work
- Prefer data correctness over UI tricks
- Prefer simple solutions over flexible abstractions

---

## Library Documentation Sources

Next.js 16 has breaking changes from earlier versions. APIs, conventions, and file structure differ from model training data. Do not write code from memory for Next.js, Vercel, Zod, or Vitest features.

### Primary source: local docs in node_modules

For Next.js, always check the bundled docs first. They match the exact installed version.

- Start with: `find node_modules/next/dist/docs/ -name "*.mdx" | head -30`
- Routing and route handlers: `node_modules/next/dist/docs/02-app/01-getting-started/`
- Caching, revalidation, PPR: `node_modules/next/dist/docs/02-app/02-guides/`
- Config and middleware: `grep -r "topic" node_modules/next/dist/docs/`

### Fallback: Context7

Use Context7 when local docs don't cover the topic, or for libraries not bundled with Next.js.

Resolve docs before:

- writing `next.config.ts`, middleware, or Vercel routing config
- integrating Zod with OpenAPI generators or other ecosystem libs
- working with Vercel deployment APIs
- you notice code referencing patterns that may be outdated

Skip Context7 for:

- DTO shaping, XML parsing, drop logic, snapshot test fixtures
- standard TypeScript, Node `fs`/`path`, base React patterns
- refactors that don't change library API surface

If unsure: skim the existing code in the repo first. If the project already uses a pattern, follow it instead of re-resolving docs.

---

## Deployment Constraints

- Hosted on Vercel in a serverless environment
- Avoid heavy runtime filesystem operations
- Data must be pre-generated at build time
- Runtime API routes should read only pre-generated JSON and static assets
- Do not rely on local datapack files, client DAT files, or external network calls at runtime
- Successful responses ship the SWR `Cache-Control` header documented
  above; error responses ship `no-store`. Both are set centrally in
  `src/lib/api/responses.ts` — do not override per route.
- Per-IP request-rate abuse is handled at the platform layer
  (Vercel Firewall / WAF), not in application code. Live rule:
  `/api/*` is limited to 60 requests / 10 seconds per IP (see
  `docs/deployment.md` for the verified record). The free plan
  allows only one WAF rule, so a stricter dedicated rule for
  `/api/*/raw/*` is deferred until a paid plan or a documented
  abuse signal. Tune from real traffic, not from imagined traffic.
- Do not introduce Redis, Upstash, or any external rate-limit store
  by default. Serverless in-memory counters are unreliable; the
  platform/WAF layer is the right tool.

---

## Decision Heuristics

When making changes:

- Prefer data correctness over UI tricks
- Prefer simple solutions over flexible abstractions

Before adding a new abstraction:

- check if the problem can be solved in DTO shaping

Before adding a new endpoint:

- check if the data is already exposed elsewhere

Before parsing a new client DAT source:

- confirm it provides clear public value
- keep parsing at build time only
- avoid broad speculative extraction

Before adding UI-only logic:

- check if it reflects a real missing API relation
- check if the same problem would affect external API consumers
- prefer improving DTO ergonomics when the relation is generally useful

---

## Hard Rules

- Do not parse XML or DAT files at runtime
- Do not hand-edit generated JSON under `data/generated/{chronicle}`
- Do not rely on local datapack files, client DAT files, or external network calls in API routes
- Do not remove or rename public DTO fields without updating `docs/api-contract.md` and snapshot tests
- Prefer adding optional fields over changing existing response shapes
- Do not introduce a database, auth, comments, moderation, or user-generated content layer
- Do not add broad abstractions for hypothetical chronicles
- Do not make raw endpoints more "friendly" by losing engine-like fidelity
- Do not let the knowledge base / explorer become the source of truth — the API is the source of truth
- Do not add explorer-specific or knowledge-base-specific UI/product features (wiki content, comments, ratings, user accounts) to this repo — they belong in the separate explorer / knowledge-base repo
- Do not cache error responses; `jsonError` must keep `Cache-Control: no-store`
- Do not introduce app-layer rate limiting (Redis/Upstash/in-memory/middleware counter) by default — platform/WAF is the v1 path
- Do not grow `PRIMARY_LOCATION_OVERRIDES_BY_NPC_ID` opportunistically; new entries require audit evidence (anchor distances, proof of resolver mis-match) and a docs link

---

## Out of Scope For Now

- Broad or speculative client-side DAT parsing
- Runtime DAT parsing
- Runtime XML parsing
- Premature support for other chronicles
- Unnecessary endpoints
- Database-backed comments
- Ratings
- User accounts
- Moderation
- Community submissions
- Screenshot/media ingestion pipeline
- Hand-maintained wiki content unless explicitly requested
- API keys, per-caller quotas, signed requests, application-layer
  `X-RateLimit-*` headers
- App-layer rate limiters (Redis/Upstash/in-memory/middleware) — defer
  to platform/WAF; revisit only on a documented abuse signal
- Polygon-based location resolution (`zonename-e.dat` polygons aren't
  decoded; nearest-anchor + narrow override map is the v1 answer)
- Mechanically-derived quest walkthroughs (we surface the client
  journal text only)
- Runtime CMS / content overrides on top of generated data

Limited parsing of skill `<for>` blocks is allowed only for currently supported cases: literal-numeric and `<table>`-referenced `<mul>`/`<add>` entries parsed into `Skill.effects`.

The following remain out of scope unless explicitly requested:

- `<effect>` blocks
- `<basemul>`
- entries gated on `<player>` conditions
- broad skill formula simulation
- full game-mechanics emulation

---

## Product Roadmap

### Phase 1 — Production Polish

Focus: make all deployed surfaces feel production-ready before doing deeper architecture work.

- Finish mobile design for all public-facing projects:
  - API / landing
  - documentation site
  - knowledge base / explorer example
- Improve SEO across all deployed surfaces:
  - page titles
  - descriptions
  - Open Graph metadata
  - favicon
  - social preview images
  - canonical URLs where needed
- Gather feedback from friends and early users.
- Improve documentation with real examples:
  - practical recipes
  - better endpoint examples
  - real Lineage 2 use cases
  - possible interactive request box inside docs
  - possible textarea/code preview for example requests
- Add analytics to each deployed project, likely Umami.
- Keep analytics privacy-friendly, lightweight, and non-invasive.

### Phase 2 — Community Launch / Distribution

Focus: help Lineage 2 developers and server communities discover the API.

- Reply to forum threads where people ask about Lineage 2 APIs, databases, drops, mobs, items, Interlude data, or tooling.
- Reach out to Lineage 2 YouTube/blog creators where the API could be useful.
- Publish a LinkedIn post about the project.
- Publish a blog post on the personal site explaining why and how the Lineage 2 API was built.
- Add more soul/personality to the project:
  - small animation
  - one tasteful Lineage 2-inspired art piece
  - nostalgic but still clean presentation
- Treat this as distribution, documentation, and product storytelling.
- Do not add community features, accounts, comments, ratings, moderation, or user-generated content to the API repo.

### Phase 3 — Architecture Split

Focus: split the current implementation into cleaner dedicated projects only after product polish and validation.

Future technical direction:

- API: likely Hono or another lightweight API-first runtime.
- Landing: likely Astro.
- Knowledge base / example client: Next.js.
- Keep generated data, DTO contract discipline, snapshot tests, cache behavior, and OpenAPI generation as first-class migration concerns.
- Migration should be incremental and reversible.
- Do not start this rewrite just because it is cleaner architecturally; do it when the current shape becomes a real maintenance or deployment problem.

---

## Roadmap Discipline

- Do not start Phase 3 architecture migration before Phase 1 polish is done unless there is a real technical blocker.
- Do not let landing, docs, or knowledge-base polish weaken the API contract.
- Do not add database, auth, comments, ratings, moderation, or community submissions to this repo.
- Treat community/distribution work as marketing and documentation work, not backend product scope.
- Prefer small visible improvements over speculative rewrites.
- Keep the API as the source of truth.
- Landing, docs, and the knowledge-base example are adoption surfaces.

---

## Goal

Build a clean, trustworthy, developer-friendly Lineage 2 API that is also useful for players.

The API is the product. Landing, docs, and the knowledge-base example are distribution and adoption surfaces.

This repo (`main`) ships the API, the public landing page, and the documentation site. The knowledge base / explorer is a separate deployed client repo that consumes this API.

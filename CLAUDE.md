@AGENTS.md

# Project Context: Lineage 2 API

## Overview

This is a public, read-only community API for Lineage 2 Interlude.

The architecture is chronicle-aware and designed to support additional chronicles in the future.

The project is unofficial and not affiliated with NCSoft.

The API will be hosted on Vercel.

---

## Branch Contexts

### main

The `main` branch is focused on the backend API only.

It is the canonical source for:

- data parsing
- generated JSON output
- public API routes
- raw API routes
- DTO mapping
- API contract documentation
- snapshot tests
- build-time enrichment

The `main` branch should stay focused on serving external API consumers.

Do not add database-explorer UI, user-facing wiki pages, comments, ratings, screenshots, or community features to `main`.

The goal of `main` is to provide a clean, stable, read-only Lineage 2 API that other clients can consume.

### ui-explorer

The `ui-explorer` branch is focused on building a lightweight database-style UI explorer on top of the public Lineage 2 API.

The explorer is a reference client and sandbox. It is not the source of truth.

Its purpose is to:

- dogfood public API endpoints
- validate DTO ergonomics
- expose missing or awkward API relations
- demonstrate real player-facing use cases
- help decide which DTOs or endpoints need improvement

The explorer should consume public API responses whenever possible.

If a UI requirement needs heavy client-side workarounds, first consider whether the DTO should be improved instead.

Explorer needs may inform API design, but should not force overly specific endpoints.

API changes from this branch are allowed only when they improve real consumer-facing API use cases and remain useful beyond the explorer UI.

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

The API currently supports:

- Items
- NPCs / Monsters
- Drops and Spoil, both directions
- Recipes
- Skills
- Armor sets

### Key Decisions

- NPC canonical identity uses:
  - `(name, level)`

- Drop system:
  - exact duplicates collapsed via `rollCount`
  - Adena (`itemId=57`) always has `type="adena"`
  - sorted for readability, not raw category order

- Skills:
  - primarily parsed from aCis XML
  - indexed by `"id-level"`
  - enriched at build time with selected client metadata when useful
  - may include `description: string | null` when available
  - `itemSkill` is resolved into DTO summaries

- NPC skill presentation:
  - public responses may separate clearly derived fields from raw engine-like entries
  - race may be exposed as a first-class field when reliably derivable
  - UI/DTO cleanup is preferred before changing core generated data

- Armor sets:
  - exposed via a single rich catalog endpoint (`GET /api/[chronicle]/armor-sets`)
  - the same per-set shape is embedded into every piece's `ItemDetailDto.partOfSets[]`
  - no separate per-id detail endpoint by design

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

## UI Explorer Guidelines

These guidelines apply primarily to the `ui-explorer` branch.

- Keep the explorer lightweight and API-driven
- Prefer simple, readable UI over complex app architecture
- Do not duplicate API business logic in the UI unless necessary
- Hide empty sections instead of rendering placeholder noise
- Use DTO fields as-is when possible
- If a page requires many extra client-side joins, consider improving the API response
- Treat icons, screenshots, and visual polish as progressive enhancements
- The explorer should validate real player-facing use cases, not invent abstract API needs

The database-style explorer is allowed to be more player-friendly and wiki-like than the API, but it must not become the source of truth.

---

## API Changes from UI Explorer Work

API changes discovered while working on the `ui-explorer` branch are allowed when they improve real explorer use cases, but they should remain:

- additive
- backward-compatible
- documented
- covered by snapshots
- useful beyond this explorer UI

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

## Deployment Constraints

- Hosted on Vercel in a serverless environment
- Avoid heavy runtime filesystem operations
- Data must be pre-generated at build time
- Runtime API routes should read only pre-generated JSON and static assets
- Do not rely on local datapack files, client DAT files, or external network calls at runtime

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
- Do not make the explorer the source of truth
- Do not add explorer-specific UI/product features to `main`

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

Limited parsing of skill `<for>` blocks is allowed only for currently supported cases: literal-numeric and `<table>`-referenced `<mul>`/`<add>` entries parsed into `Skill.effects`.

The following remain out of scope unless explicitly requested:

- `<effect>` blocks
- `<basemul>`
- entries gated on `<player>` conditions
- broad skill formula simulation
- full game-mechanics emulation

---

## Goal

Build a clean, trustworthy, developer-friendly Lineage 2 API that is also useful for players.

The API is the product.

The `main` branch is the backend API for external consumers.

The `ui-explorer` branch is the dogfooding client and visual sandbox.

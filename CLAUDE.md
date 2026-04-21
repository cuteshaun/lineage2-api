@AGENTS.md

# Project Context: Lineage 2 API

## Overview
This is a public, read-only community API for Lineage 2 Interlude.

The architecture is chronicle-aware and designed to support additional chronicles in the future.

The project is unofficial and not affiliated with NCSoft.

The API will be hosted on Vercel.

---

## Data Source & Build Model
- Data is parsed from aCis datapack XML files
- Selected client DAT metadata may be parsed at build time when it adds clear public value
- Data is generated during build (`scripts/build-data.ts`)
- Output is stored as JSON under `data/generated/{chronicle}`
- The API reads from generated JSON at runtime
- No direct XML or DAT parsing in production

---

## Product Philosophy
- Public endpoints must be:
  - clean
  - deduplicated
  - stable
  - player-friendly

- Raw endpoints must:
  - preserve original data structure
  - stay close to engine truth

- Prefer:
  - additive changes
  - backward compatibility
  - minimal abstraction

---

## Current Data Model
The API currently supports:

- Items
- NPCs / Monsters
- Drops and Spoil (both directions)
- Recipes
- Skills

### Key Decisions

- NPC canonical identity uses:
  - `(name, level)`

- Drop system:
  - exact duplicates collapsed via `rollCount`
  - Adena (`itemId=57`) always has `type="adena"`
  - sorted for readability (not raw category order)

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

---

## API Design Principles
- Public API ≠ raw engine data
- DTO layer is allowed to:
  - deduplicate
  - normalize
  - reshape data
  - enrich with already-generated metadata

- Raw data must remain unchanged unless explicitly requested

- Prefer solving problems in:
  - DTO layer
  - or UI layer
before changing core data models

---

## Engineering Guidelines
- Keep changes minimal and reversible
- Follow existing project structure
- Avoid speculative abstractions
- Validate using real Lineage 2 examples
- Preserve existing response shapes and pagination
- Prefer build-time enrichment over runtime filesystem work

---

## Deployment Constraints
- Hosted on Vercel (serverless environment)
- Avoid heavy runtime filesystem operations
- Data must be pre-generated at build time

---

## Decision Heuristics
When making changes:

- Prefer:
  - data correctness over UI tricks
  - simple solutions over flexible abstractions

- Before adding a new abstraction:
  - check if the problem can be solved in DTO shaping

- Before adding a new endpoint:
  - check if the data is already exposed elsewhere

- Before parsing a new client DAT source:
  - confirm it provides clear public value
  - keep parsing at build time only
  - avoid broad speculative extraction

---

## Out of Scope (for now)
- No deep parsing of skill effect blocks (`<for>`)
- No broad or speculative client-side DAT parsing
- No runtime DAT parsing
- No premature support for other chronicles
- No unnecessary endpoints

---

## Goal
Build a clean, trustworthy, developer-friendly Lineage 2 API
that is also useful for players.

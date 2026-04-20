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
- Data is generated during build (scripts/build-data.ts)
- Output is stored as JSON under `data/generated/{chronicle}`
- The API reads from generated JSON at runtime
- No direct XML parsing in production

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

### Key Decisions

- NPC canonical identity uses:
  - `(name, level)`

- Drop system:
  - exact duplicates collapsed via `rollCount`
  - Adena (`itemId=57`) always has `type="adena"`
  - sorted for readability (not raw category order)

- Skills:
  - parsed from XML
  - indexed by `"id-level"`
  - `itemSkill` is resolved into DTO summaries

---

## API Design Principles
- Public API ≠ raw engine data
- DTO layer is allowed to:
  - deduplicate
  - normalize
  - reshape data

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

---

## Out of Scope (for now)
- No deep parsing of skill effect blocks (`<for>`)
- No client-side DAT parsing (descriptions/icons)
- No premature support for other chronicles
- No unnecessary endpoints

---

## Goal
Build a clean, trustworthy, developer-friendly Lineage 2 API
that is also useful for players.

/**
 * Zod schemas for a small set of public DTOs — Phase A of the
 * Zod/OpenAPI migration roadmap (see `docs/api-contract.md`).
 *
 * **This file is NOT imported by any route handler.** It is consumed
 * only by `scripts/audit/generate-openapi.ts`, which means Zod and
 * `@asteasolutions/zod-to-openapi` stay out of the runtime lambda
 * bundle. The compile-time `Equals<...>` assertions below ensure
 * each schema's inferred type matches the existing hand-written DTO
 * interface byte-for-byte; if the two diverge, `pnpm typecheck`
 * fails.
 *
 * Phase A scope: three small Ref DTOs that together exercise the
 * patterns the remaining DTOs will need (required-only, nullable,
 * optional).
 *   - `NpcRefSchema`   → all-required numeric+string
 *   - `ClassRefSchema` → adds a constrained integer
 *   - `QuestRefSchema` → adds nullable + optional array
 *
 * Phase B (deferred): migrate ItemDetailDto, NpcDetailDto, etc., and
 * make schemas the source of truth (TS interfaces become
 * `z.infer<typeof ...>`).
 *
 * Phase C (deferred): generate the full OpenAPI spec from every
 * route's schema and serve it at `/api/openapi.json`.
 */

import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import type { ClassRefDto } from "./dto/class";
import type { HennaSummaryDto } from "./dto/henna";
import type { NpcRefDto } from "./dto/item";
import type { LocationRefDto } from "./dto/location";
import type {
  QuestClientJournalEntryDto,
  QuestRefDto,
} from "./dto/quest";
import type { RegionRefDto } from "./dto/region";
import type { EnrichedSpawnDto } from "./dto/spawn";

// Idempotent — adds `.openapi(...)` to Zod's prototype so registered
// schemas can carry per-field metadata for the generated spec.
extendZodWithOpenApi(z);

export const NpcRefSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
  })
  .openapi("NpcRef", {
    description:
      "Compact NPC reference used in cross-link arrays. Resolves a numeric id to a player-readable name without forcing a second round-trip.",
  });

export const ClassRefSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    professionLevel: z.number().int().min(0).max(3),
  })
  .openapi("ClassRef", {
    description:
      "Compact player-class reference. `professionLevel` is 0 (base) / 1 / 2 / 3 (no 4th profession in Interlude).",
  });

export const QuestRefSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    levelMin: z.number().int().nullable(),
    roles: z.array(z.string()).optional(),
  })
  .openapi("QuestRef", {
    description:
      "Compact quest reference used by item / NPC cross-links. `roles?` is populated only on `NpcDetailDto.involvedInQuests[]` entries (one or more of 'talk' / 'kill').",
  });

export const LocationRefSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    minLevel: z.number().int().nullable(),
  })
  .openapi("LocationRef", {
    description:
      "Compact reference to a player-facing L2 hunting / map location (e.g. \"Cruma Tower\", \"Ant Nest\", \"Sea of Spores\"). Sourced from the L2 client's `huntingzone-e.dat` center anchors. Resolution against spawn coordinates is *nearest-anchor-with-threshold* (default 10000 game units, 2D) — NOT polygon containment. `minLevel` is the recommended player level (`null` for towns and non-combat areas). Complementary to `RegionRef`, not a replacement.",
  });

export const RegionRefSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
  })
  .openapi("RegionRef", {
    description:
      "Compact reference to a named L2 map region (e.g. 'Talking Island Village'). Region ids match the upstream engine's `mapRegions.xml` numbering. The table represents engine 'death-teleport' regions, not strict biome polygons — a coordinate's region is the in-game town it teleports to on death within that tile.",
  });

export const HennaSummarySchema = z
  .object({
    symbolId: z.number().int(),
    displayName: z.string().nullable(),
    iconFile: z.string().nullable(),
    shortLabel: z.string().nullable(),
    statChanges: z
      .object({
        STR: z.number().int().optional(),
        CON: z.number().int().optional(),
        DEX: z.number().int().optional(),
        INT: z.number().int().optional(),
        MEN: z.number().int().optional(),
        WIT: z.number().int().optional(),
      }),
    engravePrice: z.number().int(),
    dyeItem: z.object({
      id: z.number().int(),
      name: z.string(),
      iconFile: z.string().nullable(),
    }),
  })
  .openapi("HennaSummary", {
    description:
      "Compact henna symbol — the engraving a player buys at a Symbol Maker (a stat-altering dye, not a cosmetic tattoo). Mechanical fields (`statChanges`, `engravePrice`, `dyeItem`) come from `hennas.xml` and are always populated. `engravePrice` is the Adena cost the Symbol Maker charges to engrave the symbol — distinct from the dye item's own vendor price. Display fields (`displayName`, `iconFile`, `shortLabel`) come from the L2 client's `hennagrp-e.dat` and are honestly `null` for the 9 +/- 4 'Greater II' tier symbols (Interlude `symbolId` 172–180), whose DAT records use a shared-prefix encoding the parser does not decode.",
  });

export const QuestClientJournalEntrySchema = z
  .object({
    stepIndex: z.number().int().min(1),
    title: z.string(),
    description: z.string(),
    completionNpc: NpcRefSchema.nullable(),
  })
  .openapi("QuestClientJournalEntry", {
    description:
      "One entry in the player's in-game quest log, sourced from the L2 client's `questname-e.dat`. Mirrors what the client actually displays — a short title, the prose journal text, and the completion NPC the player is meant to talk to next. NOT a mechanically-derived walkthrough.",
  });

export const EnrichedSpawnSchema = z
  .object({
    npcId: z.number().int(),
    x: z.number().int(),
    y: z.number().int(),
    z: z.number().int(),
    heading: z.number().int(),
    respawnDelay: z.number().int(),
    respawnRandom: z.number().int(),
    periodOfDay: z.number().int(),
    region: RegionRefSchema.nullable(),
    location: LocationRefSchema.nullable(),
  })
  .openapi("EnrichedSpawn", {
    description:
      "One cleaned-layer spawn row with the resolved map region attached. `region` is `null` when the coordinate falls outside the upstream `mapRegions.xml` tile grid, or when the chronicle ships no regions XML. The raw spawn endpoints intentionally omit this field.",
  });

// --- Compile-time parity assertions ---
//
// `Equals<X, Y>` is the standard "type-level exact equals" trick.
// `Expect<T extends true>` forces `T` to be the literal `true`. If
// the schema's inferred type drifts from the hand-written DTO
// interface (extra field, missing field, optional vs. required
// mismatch, etc.), the alias becomes `Expect<false>`, which is a
// type error and fails `pnpm typecheck` immediately.
//
// These aliases are intentionally unused at runtime — they exist
// only to wire the schemas into the type system so the build is
// the contract enforcer, not a separate test.

type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _NpcRefSchemaMatchesDto = Expect<
  Equals<z.infer<typeof NpcRefSchema>, NpcRefDto>
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ClassRefSchemaMatchesDto = Expect<
  Equals<z.infer<typeof ClassRefSchema>, ClassRefDto>
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _QuestRefSchemaMatchesDto = Expect<
  Equals<z.infer<typeof QuestRefSchema>, QuestRefDto>
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _RegionRefSchemaMatchesDto = Expect<
  Equals<z.infer<typeof RegionRefSchema>, RegionRefDto>
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _EnrichedSpawnSchemaMatchesDto = Expect<
  Equals<z.infer<typeof EnrichedSpawnSchema>, EnrichedSpawnDto>
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _QuestClientJournalEntrySchemaMatchesDto = Expect<
  Equals<
    z.infer<typeof QuestClientJournalEntrySchema>,
    QuestClientJournalEntryDto
  >
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _LocationRefSchemaMatchesDto = Expect<
  Equals<z.infer<typeof LocationRefSchema>, LocationRefDto>
>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _HennaSummarySchemaMatchesDto = Expect<
  Equals<z.infer<typeof HennaSummarySchema>, HennaSummaryDto>
>;

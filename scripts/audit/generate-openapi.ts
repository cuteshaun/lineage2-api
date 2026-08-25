/**
 * Endpoint-level OpenAPI 3.0.3 generator.
 *
 * Covers every public route under `src/app/api/[chronicle]/` with
 * path/query parameters, the `{ data }` / `{ data, meta }` response
 * envelopes, and the shared `{ error, status }` error shape.
 *
 * Schema precision is deliberately two-tier:
 *
 *   - **Exact** — list DTOs, drops, item sources, shop, hennas, meta
 *     counts. Each exact schema carries a compile-time `Equals<...>`
 *     assertion against the hand-written DTO interface (same pattern
 *     as `src/lib/api/schemas.ts`), so drift fails
 *     `pnpm typecheck:scripts`.
 *   - **Approximate** — the large detail DTOs (`ItemDetail`,
 *     `NpcDetail`, `QuestDetail`, `ClassDetail`, `ArmorSet`,
 *     `RawNpc`). These document the stable top-level fields and set
 *     `additionalProperties: true`; full field-level precision lands
 *     with the Phase B Zod migration (see `docs/api-contract.md`).
 *
 * Output: `docs/openapi.json` — committed as a build artifact so
 * contract changes are visible in PR diffs, and served verbatim at
 * `GET /api/openapi.json`.
 *
 * Usage: `pnpm openapi`
 */

import fs from "node:fs";
import path from "node:path";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
  type RouteConfig,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import {
  ClassRefSchema,
  EnrichedSpawnSchema,
  HennaSummarySchema,
  LocationRefSchema,
  NpcRefSchema,
  QuestClientJournalEntrySchema,
  QuestRefSchema,
  RegionRefSchema,
} from "../../src/lib/api/schemas";

import type { ItemListDto } from "../../src/lib/api/dto/item";
import type {
  ExchangeOptionDto,
  ItemQuantityDto,
  ShopProductDto,
} from "../../src/lib/api/dto/item";
import type { NpcListDto } from "../../src/lib/api/dto/npc";
import type { QuestListDto } from "../../src/lib/api/dto/quest";
import type { ClassListDto } from "../../src/lib/api/dto/class";
import type {
  DropDto,
  ItemSourceEntryDto,
  ItemSourceNpcDto,
  NpcDropsDto,
} from "../../src/lib/api/dto/drops";
import type { HennaDetailDto } from "../../src/lib/api/dto/henna";
import type { ShopResponseDto } from "../../src/lib/api/dto/shop";
import type { NameCount, NpcTypeSummary } from "../../src/lib/data/indexes";
import type { Spawn } from "../../src/lib/types";

extendZodWithOpenApi(z);

const pkgPath = path.join(process.cwd(), "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
const apiVersion = pkg.version;

// --- Compile-time parity assertions (same trick as src/lib/api/schemas.ts) ---

type Equals<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;

// =====================================================================
// Shared envelope schemas
// =====================================================================

const ApiErrorSchema = z
  .object({
    error: z.string(),
    status: z.number().int(),
  })
  .openapi("ApiError", {
    description:
      "Error envelope returned by every 4xx/5xx response. Error responses always carry `Cache-Control: no-store` (success responses are CDN-cacheable).",
  });

const ListMetaSchema = z
  .object({
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .openapi("ListMeta", {
    description:
      "Pagination metadata for list responses. Catalog endpoints that return everything in one page (quests, classes, armor-sets, locations, regions, hennas) set `limit = total` and `offset = 0`.",
  });

// =====================================================================
// Exact entity schemas (Equals-asserted against the DTO interfaces)
// =====================================================================

const ItemSummarySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    type: z.string(),
    grade: z.string(),
    weight: z.number().nullable(),
    price: z.number().nullable(),
    iconFile: z.string().nullable(),
  })
  .openapi("ItemSummary", {
    description: "One row of the paginated `/items` list.",
  });

const NpcSummarySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    title: z.string().nullable(),
    level: z.number().nullable(),
    npcType: z.string().nullable(),
    hp: z.number().nullable(),
    isAggressive: z.boolean(),
  })
  .openapi("NpcSummary", {
    description:
      "One row of the paginated `/npcs` or `/monsters` list (cleaned layer — one record per unique NPC name+level).",
  });

const QuestSummarySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    levelMin: z.number().int().nullable(),
    repeatable: z.boolean().nullable(),
    raceRestrictions: z.array(z.string()),
    classRestrictions: z.array(ClassRefSchema),
    startNpc: NpcRefSchema.nullable(),
    rewardsPreview: z.object({
      adena: z.number().nullable(),
      exp: z.number().nullable(),
      sp: z.number().nullable(),
      itemCount: z.number().int(),
    }),
  })
  .openapi("QuestSummary", {
    description:
      "One row of the `/quests` catalog. `rewardsPreview.itemCount` is the length of the detail-level `rewards.items[]`.",
  });

const ClassSummarySchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    race: z.string(),
    type: z.string(),
    professionLevel: z.number().int(),
    parentClassId: z.number().int().nullable(),
  })
  .openapi("ClassSummary", {
    description:
      "One row of the `/classes` catalog. Class ids start at 0 (Human Fighter).",
  });

const DropSchema = z
  .object({
    itemId: z.number().int(),
    itemName: z.string().nullable(),
    qty: z.string(),
    chance: z.number().nullable(),
    chanceDisplay: z.string().nullable(),
    type: z.enum(["spoil", "adena", "regular"]),
    rollCount: z.number().int().optional(),
  })
  .openapi("Drop", {
    description:
      "One deduplicated drop/spoil row. `chance` is a percentage (already divided by the engine's 10000 base). Exact duplicate rows are collapsed; `rollCount` (>1) carries the original multiplicity. Adena (itemId 57) always has `type: \"adena\"`.",
  });

const NpcDropsSchema = z
  .object({
    npcId: z.number().int(),
    npcName: z.string(),
    drops: z.array(DropSchema),
  })
  .openapi("NpcDrops", {
    description:
      "All drops and spoil for one cleaned NPC, sorted adena → regular → spoil, then by chance descending.",
  });

const ItemSourceNpcSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    type: z.string().nullable(),
    level: z.number().nullable(),
  })
  .openapi("ItemSourceNpc", {
    description: "Compact NPC reference inside dropped-by / spoiled-by rows.",
  });

const ItemSourceEntrySchema = z
  .object({
    npc: ItemSourceNpcSchema,
    qty: z.string(),
    chance: z.number().nullable(),
    chanceDisplay: z.string().nullable(),
    rollCount: z.number().int().optional(),
  })
  .openapi("ItemSourceEntry", {
    description:
      "One source NPC for an item (reverse lookup row of `/items/{id}/dropped-by` and `/items/{id}/spoiled-by`).",
  });

const ItemQuantitySchema = z
  .object({
    itemId: z.number().int(),
    name: z.string(),
    iconFile: z.string().nullable(),
    count: z.number().int(),
  })
  .openapi("ItemQuantity", {
    description: "An item id + display name with a quantity.",
  });

const ShopProductSchema = z
  .object({
    itemId: z.number().int(),
    name: z.string(),
    iconFile: z.string().nullable(),
    price: z.number().int(),
    buyListId: z.number().int(),
  })
  .openapi("ShopProduct", {
    description: "One merchant buy-list row, sorted by price ascending.",
  });

const ExchangeOptionSchema = z
  .object({
    multisellId: z.number().int(),
    maintainEnchantment: z.boolean(),
    npcs: z.array(NpcRefSchema),
    required: z.array(ItemQuantitySchema),
    produces: ItemQuantitySchema,
  })
  .openapi("ExchangeOption", {
    description: "One fully-resolved multisell exchange row.",
  });

const ShopViewSchema = z
  .object({
    npc: NpcRefSchema,
    buyList: z.array(ShopProductSchema).optional(),
    exchanges: z.array(ExchangeOptionSchema).optional(),
  })
  .openapi("ShopView", {
    description:
      "Everything one NPC sells or exchanges. `buyList` and `exchanges` are omitted (not empty arrays) when the NPC has none of that kind.",
  });

const HennaDetailSchema = HennaSummarySchema.extend({
  allowedClasses: z.array(ClassRefSchema),
}).openapi("HennaDetail", {
  description:
    "Henna symbol detail — the catalog fields plus the resolved `allowedClasses` (sorted by class id).",
});

const NameCountSchema = z
  .object({
    name: z.string(),
    count: z.number().int(),
  })
  .openapi("NameCount", {
    description:
      "Introspection row: one distinct value with its record count. Computed from the actual dataset, not a hardcoded enum.",
  });

const NpcTypeCountSchema = z
  .object({
    name: z.string(),
    isMonster: z.boolean(),
    count: z.number().int(),
  })
  .openapi("NpcTypeCount", {
    description:
      "Introspection row for one `npcType` value. `isMonster` marks the types included in the `/monsters` subset.",
  });

const RawSpawnSchema = z
  .object({
    npcId: z.number().int(),
    x: z.number().int(),
    y: z.number().int(),
    z: z.number().int(),
    heading: z.number().int(),
    respawnDelay: z.number().int(),
    respawnRandom: z.number().int(),
    periodOfDay: z.number().int(),
  })
  .openapi("RawSpawn", {
    description:
      "One source-faithful spawn row (no region/location enrichment — that lives on the cleaned `/npcs/{id}/spawns` endpoint).",
  });

// Wire the exact schemas into the type system: if a schema drifts from
// its DTO interface, `pnpm typecheck:scripts` fails.
/* eslint-disable @typescript-eslint/no-unused-vars */
type _ItemSummaryMatches = Expect<
  Equals<z.infer<typeof ItemSummarySchema>, ItemListDto>
>;
type _NpcSummaryMatches = Expect<
  Equals<z.infer<typeof NpcSummarySchema>, NpcListDto>
>;
type _QuestSummaryMatches = Expect<
  Equals<z.infer<typeof QuestSummarySchema>, QuestListDto>
>;
type _ClassSummaryMatches = Expect<
  Equals<z.infer<typeof ClassSummarySchema>, ClassListDto>
>;
type _DropMatches = Expect<Equals<z.infer<typeof DropSchema>, DropDto>>;
type _NpcDropsMatches = Expect<
  Equals<z.infer<typeof NpcDropsSchema>, NpcDropsDto>
>;
type _ItemSourceNpcMatches = Expect<
  Equals<z.infer<typeof ItemSourceNpcSchema>, ItemSourceNpcDto>
>;
type _ItemSourceEntryMatches = Expect<
  Equals<z.infer<typeof ItemSourceEntrySchema>, ItemSourceEntryDto>
>;
type _ItemQuantityMatches = Expect<
  Equals<z.infer<typeof ItemQuantitySchema>, ItemQuantityDto>
>;
type _ShopProductMatches = Expect<
  Equals<z.infer<typeof ShopProductSchema>, ShopProductDto>
>;
type _ExchangeOptionMatches = Expect<
  Equals<z.infer<typeof ExchangeOptionSchema>, ExchangeOptionDto>
>;
type _ShopViewMatches = Expect<
  Equals<z.infer<typeof ShopViewSchema>, ShopResponseDto>
>;
type _HennaDetailMatches = Expect<
  Equals<z.infer<typeof HennaDetailSchema>, HennaDetailDto>
>;
type _NameCountMatches = Expect<
  Equals<z.infer<typeof NameCountSchema>, NameCount>
>;
type _NpcTypeCountMatches = Expect<
  Equals<z.infer<typeof NpcTypeCountSchema>, NpcTypeSummary>
>;
type _RawSpawnMatches = Expect<Equals<z.infer<typeof RawSpawnSchema>, Spawn>>;
/* eslint-enable @typescript-eslint/no-unused-vars */

// =====================================================================
// Approximate detail schemas (Phase B pending)
// =====================================================================

const PHASE_B_NOTE =
  " Only the stable top-level fields are listed; the response carries additional documented properties (see docs/api-contract.md). Field-level schema precision improves in a later phase of the Zod migration.";

const ItemDetailSchema = z
  .looseObject({
    id: z.number().int(),
    name: z.string(),
    type: z.string(),
    grade: z.string(),
    weight: z.number().nullable(),
    price: z.number().nullable(),
    material: z.string().nullable(),
    iconFile: z.string().nullable(),
  })
  .openapi("ItemDetail", {
    description:
      "Full item detail with cross-links (category/stats groups, armor sets, recipes, exchanges, quests, shops, spellbook, henna)." +
      PHASE_B_NOTE,
  });

const NpcDetailSchema = z
  .looseObject({
    id: z.number().int(),
    name: z.string(),
    level: z.number().nullable(),
    npcType: z.string().nullable(),
    isAggressive: z.boolean(),
  })
  .openapi("NpcDetail", {
    description:
      "Full cleaned NPC/monster detail (stats, baseStats, optional behavior group, skills, quests, drops/spawn cross-links). The `{id}` parameter accepts the canonical id or any merged raw id." +
      PHASE_B_NOTE,
  });

const QuestDetailSchema = z
  .looseObject({
    id: z.number().int(),
    name: z.string(),
    levelMin: z.number().int().nullable(),
    repeatable: z.boolean().nullable(),
  })
  .openapi("QuestDetail", {
    description:
      "Full quest detail (restrictions, NPCs, quest items, rewards, optional client journal entries)." +
      PHASE_B_NOTE,
  });

const ClassDetailSchema = z
  .looseObject({
    id: z.number().int(),
    name: z.string(),
    race: z.string(),
    type: z.string(),
    professionLevel: z.number().int(),
    parentClassId: z.number().int().nullable(),
  })
  .openapi("ClassDetail", {
    description:
      "Full class detail with the skill-learn table and spellbook references." +
      PHASE_B_NOTE,
  });

const ArmorSetSchema = z
  .looseObject({
    id: z.number().int(),
    name: z.string(),
  })
  .openapi("ArmorSet", {
    description:
      "One armor set with its pieces and bonus skills. The same shape is embedded into every piece's `ItemDetail.partOfSets[]`." +
      PHASE_B_NOTE,
  });

const RawNpcSchema = z
  .looseObject({
    id: z.number().int(),
    name: z.string(),
    level: z.number().nullable(),
  })
  .openapi("RawNpc", {
    description:
      "Source-faithful parsed NPC record, engine-shaped. Every raw row carries `mergedIds=[id]` and `mergedCount=1` for shape parity with the cleaned layer." +
      PHASE_B_NOTE,
  });

// =====================================================================
// Parameters
// =====================================================================

const chronicleParam = z.enum(["interlude"]).openapi({
  description: "Game chronicle. Only `interlude` is currently supported.",
  example: "interlude",
});

const idParam = (description: string, example: number, min = 1) =>
  z.number().int().min(min).openapi({ description, example });

const limitParam = (defaultLimit: number) =>
  z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .openapi({
      description: `Page size. Default ${defaultLimit}. Values above 200 are clamped to 200.`,
    });

const offsetParam = z.number().int().min(0).optional().openapi({
  description: "Number of rows to skip. Default 0.",
});

const qParam = z.string().optional().openapi({
  description: "Case-insensitive substring match on the name.",
});

const itemSortParam = z
  .enum(["id", "-id", "name", "-name", "grade", "-grade"])
  .optional()
  .openapi({
    description: "Sort field; prefix with `-` for descending. Default: dataset order (by id).",
  });

const npcSortParam = z
  .enum(["id", "-id", "name", "-name", "level", "-level"])
  .optional()
  .openapi({
    description: "Sort field; prefix with `-` for descending. Default: dataset order (by id).",
  });

const levelMinParam = z.number().int().optional().openapi({
  description: "Minimum NPC level (inclusive). Must be <= levelMax when both are set.",
});

const levelMaxParam = z.number().int().optional().openapi({
  description: "Maximum NPC level (inclusive).",
});

const npcTypeParam = (monstersOnly: boolean) =>
  z
    .string()
    .optional()
    .openapi({
      description:
        `Filter by engine npcType (case-insensitive). Allowed values are dataset-derived — list them via \`/{chronicle}/meta/npc-types\`.` +
        (monstersOnly ? " Restricted to the monster subset on this endpoint." : ""),
    });

const npcListQuery = (monstersOnly: boolean) =>
  z.object({
    limit: limitParam(50),
    offset: offsetParam,
    q: qParam,
    levelMin: levelMinParam,
    levelMax: levelMaxParam,
    npcType: npcTypeParam(monstersOnly),
    sort: npcSortParam,
  });

// =====================================================================
// Response helpers
// =====================================================================

type ZodSchema = Parameters<OpenAPIRegistry["register"]>[1];

const jsonContent = (schema: ZodSchema) => ({
  content: { "application/json": { schema } },
});

const ERROR_400 = {
  description: "Invalid parameter (malformed id, bad pagination, unknown enum value, …).",
  ...jsonContent(ApiErrorSchema),
};

const ERROR_404 = {
  description: "Unknown chronicle, or no entity with this id.",
  ...jsonContent(ApiErrorSchema),
};

/** `{ data: [...], meta: {...} }` — paginated or single-page list. */
const listResponses = (schema: ZodSchema, description: string) => ({
  200: {
    description,
    ...jsonContent(z.object({ data: z.array(schema), meta: ListMetaSchema })),
  },
  400: ERROR_400,
  404: ERROR_404,
});

/** `{ data: {...} }` — single-entity detail. */
const detailResponses = (schema: ZodSchema, description: string) => ({
  200: { description, ...jsonContent(z.object({ data: schema })) },
  400: ERROR_400,
  404: ERROR_404,
});

/** `{ data: [...] }` — unpaginated array (no meta). */
const arrayResponses = (schema: ZodSchema, description: string) => ({
  200: { description, ...jsonContent(z.object({ data: z.array(schema) })) },
  400: ERROR_400,
  404: ERROR_404,
});

// =====================================================================
// Registry
// =====================================================================

const registry = new OpenAPIRegistry();

// Shared Phase-A schemas (src/lib/api/schemas.ts).
registry.register("NpcRef", NpcRefSchema);
registry.register("ClassRef", ClassRefSchema);
registry.register("QuestRef", QuestRefSchema);
registry.register("RegionRef", RegionRefSchema);
registry.register("EnrichedSpawn", EnrichedSpawnSchema);
registry.register("QuestClientJournalEntry", QuestClientJournalEntrySchema);
registry.register("LocationRef", LocationRefSchema);
registry.register("HennaSummary", HennaSummarySchema);

// Envelopes.
registry.register("ApiError", ApiErrorSchema);
registry.register("ListMeta", ListMetaSchema);

// Exact entity schemas.
registry.register("ItemSummary", ItemSummarySchema);
registry.register("NpcSummary", NpcSummarySchema);
registry.register("QuestSummary", QuestSummarySchema);
registry.register("ClassSummary", ClassSummarySchema);
registry.register("Drop", DropSchema);
registry.register("NpcDrops", NpcDropsSchema);
registry.register("ItemSourceNpc", ItemSourceNpcSchema);
registry.register("ItemSourceEntry", ItemSourceEntrySchema);
registry.register("ItemQuantity", ItemQuantitySchema);
registry.register("ShopProduct", ShopProductSchema);
registry.register("ExchangeOption", ExchangeOptionSchema);
registry.register("ShopView", ShopViewSchema);
registry.register("HennaDetail", HennaDetailSchema);
registry.register("NameCount", NameCountSchema);
registry.register("NpcTypeCount", NpcTypeCountSchema);
registry.register("RawSpawn", RawSpawnSchema);

// Approximate detail schemas (Phase B pending).
registry.register("ItemDetail", ItemDetailSchema);
registry.register("NpcDetail", NpcDetailSchema);
registry.register("QuestDetail", QuestDetailSchema);
registry.register("ClassDetail", ClassDetailSchema);
registry.register("ArmorSet", ArmorSetSchema);
registry.register("RawNpc", RawNpcSchema);

// =====================================================================
// Paths — one registerPath per route under src/app/api/[chronicle]/
// =====================================================================

const route = (config: RouteConfig) => registry.registerPath(config);

// ── Items ──

route({
  method: "get",
  path: "/{chronicle}/items",
  tags: ["Items"],
  summary: "List items",
  request: {
    params: z.object({ chronicle: chronicleParam }),
    query: z.object({
      limit: limitParam(50),
      offset: offsetParam,
      q: qParam,
      type: z.enum(["weapon", "armor", "etcitem"]).optional().openapi({
        description: "Filter by item type (case-insensitive).",
      }),
      grade: z.enum(["none", "d", "c", "b", "a", "s"]).optional().openapi({
        description: "Filter by crystal grade (case-insensitive).",
      }),
      sort: itemSortParam,
    }),
  },
  responses: listResponses(ItemSummarySchema, "Paginated item list."),
});

route({
  method: "get",
  path: "/{chronicle}/items/{id}",
  tags: ["Items"],
  summary: "Item detail",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Item id.", 57),
    }),
  },
  responses: detailResponses(ItemDetailSchema, "Full item detail with cross-links."),
});

route({
  method: "get",
  path: "/{chronicle}/items/{id}/dropped-by",
  tags: ["Items"],
  summary: "NPCs that drop this item",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Item id.", 57),
    }),
    query: z.object({ limit: limitParam(25), offset: offsetParam }),
  },
  responses: listResponses(
    ItemSourceEntrySchema,
    "Paginated reverse lookup: which NPCs drop this item."
  ),
});

route({
  method: "get",
  path: "/{chronicle}/items/{id}/spoiled-by",
  tags: ["Items"],
  summary: "NPCs that spoil this item",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Item id.", 1864),
    }),
    query: z.object({ limit: limitParam(25), offset: offsetParam }),
  },
  responses: listResponses(
    ItemSourceEntrySchema,
    "Paginated reverse lookup: which NPCs spoil this item."
  ),
});

// ── NPCs ──

route({
  method: "get",
  path: "/{chronicle}/npcs",
  tags: ["NPCs"],
  summary: "List NPCs (cleaned)",
  description:
    "Cleaned layer — one record per unique NPC name+level; merged raw ids are listed on the detail's `mergedIds`. For the source-faithful list see `/{chronicle}/raw/npcs`.",
  request: {
    params: z.object({ chronicle: chronicleParam }),
    query: npcListQuery(false),
  },
  responses: listResponses(NpcSummarySchema, "Paginated NPC list."),
});

route({
  method: "get",
  path: "/{chronicle}/npcs/{id}",
  tags: ["NPCs"],
  summary: "NPC detail (cleaned)",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Canonical NPC id, or any merged raw id.", 30048),
    }),
  },
  responses: detailResponses(NpcDetailSchema, "Full cleaned NPC detail."),
});

route({
  method: "get",
  path: "/{chronicle}/npcs/{id}/spawns",
  tags: ["NPCs"],
  summary: "NPC spawn points (enriched)",
  description:
    "Cleaned spawn rows enriched with resolved `region` and `location`. Returns `{ data: [] }` when the NPC exists but has no spawns; 404 only when the id is unknown.",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Canonical NPC id, or any merged raw id.", 20001),
    }),
  },
  responses: arrayResponses(EnrichedSpawnSchema, "Enriched spawn rows."),
});

route({
  method: "get",
  path: "/{chronicle}/npcs/{id}/drops",
  tags: ["NPCs", "Drops"],
  summary: "NPC drops and spoil",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Canonical NPC id, or any merged raw id.", 20001),
    }),
  },
  responses: detailResponses(
    NpcDropsSchema,
    "All drops and spoil for this NPC. 404 when the NPC has no drops."
  ),
});

route({
  method: "get",
  path: "/{chronicle}/npcs/{id}/shop",
  tags: ["NPCs", "Shops"],
  summary: "NPC shop view",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("NPC id.", 30001),
    }),
  },
  responses: detailResponses(
    ShopViewSchema,
    "Merchant buy-list rows and/or curated multisell exchanges for this NPC."
  ),
});

// ── Monsters ──

route({
  method: "get",
  path: "/{chronicle}/monsters",
  tags: ["Monsters"],
  summary: "List monsters (cleaned)",
  description:
    "The monster subset of the cleaned NPC list. For the source-faithful list see `/{chronicle}/raw/monsters`.",
  request: {
    params: z.object({ chronicle: chronicleParam }),
    query: npcListQuery(true),
  },
  responses: listResponses(NpcSummarySchema, "Paginated monster list."),
});

route({
  method: "get",
  path: "/{chronicle}/monsters/{id}",
  tags: ["Monsters"],
  summary: "Monster detail (cleaned)",
  description:
    "Same shape as NPC detail. Non-monster NPC ids return 404 — this endpoint mirrors the monster-type gate of the list.",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Canonical monster id, or any merged raw id.", 20001),
    }),
  },
  responses: detailResponses(NpcDetailSchema, "Full cleaned monster detail."),
});

route({
  method: "get",
  path: "/{chronicle}/monsters/{id}/drops",
  tags: ["Monsters", "Drops"],
  summary: "Monster drops and spoil",
  description:
    "Same response shape as `/{chronicle}/npcs/{id}/drops`, scoped to the monster subset. Non-monster NPC ids return 404 — this endpoint mirrors the monster-type gate of `/{chronicle}/monsters/{id}`.",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Canonical monster id, or any merged raw id.", 22001),
    }),
  },
  responses: detailResponses(
    NpcDropsSchema,
    "All drops and spoil for this monster. 404 when the id is not a monster or the monster has no drops."
  ),
});

// ── Drops alias ──

route({
  method: "get",
  path: "/{chronicle}/drops/npc/{id}",
  tags: ["Drops"],
  summary: "NPC drops and spoil (alias)",
  description: "Alias of `/{chronicle}/npcs/{id}/drops` — identical response.",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Canonical NPC id, or any merged raw id.", 20001),
    }),
  },
  responses: detailResponses(
    NpcDropsSchema,
    "All drops and spoil for this NPC. 404 when the NPC has no drops."
  ),
});

// ── Quests ──

route({
  method: "get",
  path: "/{chronicle}/quests",
  tags: ["Quests"],
  summary: "List all quests",
  description: "Single-page catalog (no pagination params): `meta.limit = total`.",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: listResponses(QuestSummarySchema, "All quests."),
});

route({
  method: "get",
  path: "/{chronicle}/quests/{id}",
  tags: ["Quests"],
  summary: "Quest detail",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Quest id.", 1),
    }),
  },
  responses: detailResponses(QuestDetailSchema, "Full quest detail."),
});

// ── Classes ──

route({
  method: "get",
  path: "/{chronicle}/classes",
  tags: ["Classes"],
  summary: "List all classes",
  description: "Single-page catalog (no pagination params): `meta.limit = total`.",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: listResponses(ClassSummarySchema, "All player classes."),
});

route({
  method: "get",
  path: "/{chronicle}/classes/{id}",
  tags: ["Classes"],
  summary: "Class detail",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Class id. Ids start at 0 (Human Fighter).", 0, 0),
    }),
  },
  responses: detailResponses(
    ClassDetailSchema,
    "Full class detail with skill-learn table."
  ),
});

// ── Armor sets ──

route({
  method: "get",
  path: "/{chronicle}/armor-sets",
  tags: ["Armor Sets"],
  summary: "List all armor sets",
  description:
    "Single-page rich catalog (no pagination params, no per-id detail endpoint by design). The same per-set shape is embedded into every piece's `ItemDetail.partOfSets[]`.",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: listResponses(ArmorSetSchema, "All armor sets."),
});

// ── Hennas ──

route({
  method: "get",
  path: "/{chronicle}/hennas",
  tags: ["Hennas"],
  summary: "List all henna symbols",
  description: "Single-page catalog (no pagination params): `meta.limit = total`.",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: listResponses(HennaSummarySchema, "All henna symbols."),
});

route({
  method: "get",
  path: "/{chronicle}/hennas/{id}",
  tags: ["Hennas"],
  summary: "Henna detail",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Henna symbolId (source XML id, 1..N).", 1),
    }),
  },
  responses: detailResponses(
    HennaDetailSchema,
    "Henna symbol with resolved allowed classes."
  ),
});

// ── Locations & regions ──

route({
  method: "get",
  path: "/{chronicle}/locations",
  tags: ["Locations"],
  summary: "List all locations",
  description:
    "Single-page catalog of player-facing hunting/map locations (center anchors from `huntingzone-e.dat`, not polygons).",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: listResponses(LocationRefSchema, "All locations."),
});

route({
  method: "get",
  path: "/{chronicle}/regions",
  tags: ["Regions"],
  summary: "List all regions",
  description:
    "Single-page catalog of named engine map regions (`mapRegions.xml` death-teleport regions).",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: listResponses(RegionRefSchema, "All regions."),
});

// ── Meta / introspection ──

route({
  method: "get",
  path: "/{chronicle}/meta/item-grades",
  tags: ["Meta"],
  summary: "Item grade values with counts",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: arrayResponses(NameCountSchema, "All item grade values."),
});

route({
  method: "get",
  path: "/{chronicle}/meta/item-types",
  tags: ["Meta"],
  summary: "Item type values with counts",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: arrayResponses(NameCountSchema, "All item type values."),
});

route({
  method: "get",
  path: "/{chronicle}/meta/npc-types",
  tags: ["Meta"],
  summary: "NPC type values with counts",
  request: { params: z.object({ chronicle: chronicleParam }) },
  responses: arrayResponses(NpcTypeCountSchema, "All npcType values."),
});

// ── Raw layer ──

route({
  method: "get",
  path: "/{chronicle}/raw/npcs",
  tags: ["Raw"],
  summary: "List NPCs (raw)",
  description:
    "Source-faithful list preserving every raw entry (no name dedup). Same filters as the cleaned list.",
  request: {
    params: z.object({ chronicle: chronicleParam }),
    query: npcListQuery(false),
  },
  responses: listResponses(RawNpcSchema, "Paginated raw NPC list."),
});

route({
  method: "get",
  path: "/{chronicle}/raw/npcs/{id}",
  tags: ["Raw"],
  summary: "NPC detail (raw)",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Source-faithful raw NPC id.", 30048),
    }),
  },
  responses: detailResponses(RawNpcSchema, "One raw NPC record."),
});

route({
  method: "get",
  path: "/{chronicle}/raw/monsters",
  tags: ["Raw"],
  summary: "List monsters (raw)",
  request: {
    params: z.object({ chronicle: chronicleParam }),
    query: npcListQuery(true),
  },
  responses: listResponses(RawNpcSchema, "Paginated raw monster list."),
});

route({
  method: "get",
  path: "/{chronicle}/raw/monsters/{id}",
  tags: ["Raw"],
  summary: "Monster detail (raw)",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Source-faithful raw monster id.", 20001),
    }),
  },
  responses: detailResponses(RawNpcSchema, "One raw monster record."),
});

route({
  method: "get",
  path: "/{chronicle}/raw/monsters/{id}/spawns",
  tags: ["Raw"],
  summary: "Monster spawn points (raw)",
  description:
    "Source-faithful spawn rows — intentionally no region/location enrichment. Returns `{ data: [] }` when the monster exists but has no spawns.",
  request: {
    params: z.object({
      chronicle: chronicleParam,
      id: idParam("Source-faithful raw monster id.", 20001),
    }),
  },
  responses: arrayResponses(RawSpawnSchema, "Raw spawn rows."),
});

// =====================================================================
// Document
// =====================================================================

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "Lineage 2 API",
    version: apiVersion,
    description:
      "Public read-only API over Lineage 2 Interlude datapack content. " +
      "Every endpoint is documented with its parameters and response " +
      "envelope. List/summary, drop, shop, and henna schemas are exact; " +
      "the large detail schemas (ItemDetail, NpcDetail, QuestDetail, " +
      "ClassDetail, ArmorSet, RawNpc) document the stable top-level " +
      "fields and allow additional properties — field-level precision " +
      "for those improves in a later phase of the Zod migration. See " +
      "docs/api-contract.md for the full prose contract.",
  },
  servers: [
    {
      url: "/api",
      description:
        "API root. All data paths are chronicle-scoped via the {chronicle} path parameter.",
    },
  ],
});

// Zod's loose-object catchall emits `additionalProperties: { nullable: true }`;
// normalize the approximate schemas to the conventional boolean form.
const APPROXIMATE_SCHEMAS = [
  "ItemDetail",
  "NpcDetail",
  "QuestDetail",
  "ClassDetail",
  "ArmorSet",
  "RawNpc",
];
const schemas = (document.components?.schemas ?? {}) as Record<
  string,
  { additionalProperties?: unknown }
>;
for (const name of APPROXIMATE_SCHEMAS) {
  if (!schemas[name]) throw new Error(`Missing approximate schema: ${name}`);
  schemas[name].additionalProperties = true;
}

const outPath = path.join(process.cwd(), "docs", "openapi.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");

const schemaCount = Object.keys(document.components?.schemas ?? {}).length;
const pathCount = Object.keys(document.paths ?? {}).length;
console.log(`[generate-openapi] Wrote ${outPath}`);
console.log(`  Registered schemas: ${schemaCount}`);
console.log(`  Paths: ${pathCount}`);

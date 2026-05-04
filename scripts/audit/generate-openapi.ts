/**
 * Stub OpenAPI 3.0 generator.
 *
 * Phase A of the Zod migration (see `src/lib/api/schemas.ts`):
 * registers the small Ref schemas and emits an OpenAPI document
 * with `components.schemas` populated and `paths` empty. The point
 * is to prove the pipeline works end-to-end without committing to
 * the full DTO migration.
 *
 * Output: `docs/openapi.stub.json` — committed as a build artifact
 * so contract changes are visible in PR diffs. When Phase B/C land,
 * this stub is replaced by a real per-route generator.
 *
 * Usage: `pnpm openapi`
 */

import fs from "node:fs";
import path from "node:path";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

import {
  ClassRefSchema,
  EnrichedSpawnSchema,
  LocationRefSchema,
  NpcRefSchema,
  QuestClientJournalEntrySchema,
  QuestRefSchema,
  RegionRefSchema,
} from "../../src/lib/api/schemas";

const registry = new OpenAPIRegistry();
registry.register("NpcRef", NpcRefSchema);
registry.register("ClassRef", ClassRefSchema);
registry.register("QuestRef", QuestRefSchema);
registry.register("RegionRef", RegionRefSchema);
registry.register("EnrichedSpawn", EnrichedSpawnSchema);
registry.register("QuestClientJournalEntry", QuestClientJournalEntrySchema);
registry.register("LocationRef", LocationRefSchema);

const generator = new OpenApiGeneratorV3(registry.definitions);
const document = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "Lineage 2 API",
    version: "0.1.0",
    description:
      "Public read-only API over Lineage 2 Interlude datapack content. " +
      "This document is a STUB: only a small set of shared reference " +
      "schemas are registered. Full per-route coverage lands in a later " +
      "phase of the Zod migration — see docs/api-contract.md.",
  },
  servers: [{ url: "/api/{chronicle}", description: "Chronicle-scoped base path" }],
});

const outPath = path.join(process.cwd(), "docs", "openapi.stub.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(document, null, 2) + "\n");

const schemaCount = Object.keys(document.components?.schemas ?? {}).length;
console.log(`[generate-openapi] Wrote stub to ${outPath}`);
console.log(`  Registered schemas: ${schemaCount}`);

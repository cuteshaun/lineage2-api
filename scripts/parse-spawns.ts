import fs from "node:fs";
import path from "node:path";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import type { Chronicle } from "../src/lib/chronicles";
import type { Spawn } from "../src/lib/types";
import { getChronicleSources } from "./chronicle-sources";

/**
 * First-iteration spawn parser.
 *
 * Source: `<datapack>/sql/spawnlist.sql` — a single `INSERT INTO spawnlist
 * VALUES (...),(...),...;` statement. The upstream schema is:
 *
 *   npc_templateid, locx, locy, locz, heading,
 *   respawn_delay, respawn_rand, periodOfDay
 *
 * Every value in every tuple is a single-quoted integer, e.g.:
 *   ('18001', '178814', '8022', '-2728', '0', '25', '0', '0'),
 *
 * We preserve one row per source row — no dedup, no grouping, no NPC-id
 * aggregation. Output is a flat `Spawn[]` written to
 * `data/generated/<chronicle>/spawns.json`, intentionally kept separate
 * from items/npcs/drops so this first iteration stays internal (not yet
 * exposed via any public API route).
 *
 * Sibling spawn files (`raidboss_spawnlist.sql`, `spawnlist_4s.sql`,
 * `random_spawn*.sql`) are deliberately NOT parsed here — each has a
 * different schema and different semantics. See the task summary for
 * follow-up notes.
 */

// A complete spawn row: 8 single-quoted integers inside parens, terminated
// by `,` or `);`. Using a strict regex because the source format is uniform
// across all 40k+ rows; any malformed line falls through to the "skipped"
// counter and is logged.
const TUPLE_RE =
  /^\(\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*\)\s*[,;]?\s*$/;

function parseSpawnFile(absPath: string): {
  spawns: Spawn[];
  skipped: number;
} {
  if (!fs.existsSync(absPath)) {
    console.error(`[parse-spawns] SQL file not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");

  // Find the VALUES keyword once; everything before it is DDL (DROP/CREATE).
  // `INSERT INTO \`spawnlist\` VALUES\n(...),(...);`
  const valuesIdx = raw.search(/\bVALUES\b/i);
  if (valuesIdx < 0) {
    console.error(
      `[parse-spawns] No VALUES keyword in ${absPath} — is this the right file?`
    );
    process.exit(1);
  }

  const body = raw.slice(valuesIdx);
  const spawns: Spawn[] = [];
  let skipped = 0;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    // Tuples always start with `(`. Skip the leading `VALUES` word and any
    // SQL comments (-- ...).
    if (!line.startsWith("(")) continue;
    if (line.startsWith("--")) continue;

    const m = TUPLE_RE.exec(line);
    if (!m) {
      skipped++;
      console.warn(
        `[parse-spawns] Skipping malformed tuple: ${line.slice(0, 120)}`
      );
      continue;
    }

    spawns.push({
      npcId: Number(m[1]),
      x: Number(m[2]),
      y: Number(m[3]),
      z: Number(m[4]),
      heading: Number(m[5]),
      respawnDelay: Number(m[6]),
      respawnRandom: Number(m[7]),
      periodOfDay: Number(m[8]),
    });
  }

  return { spawns, skipped };
}

export async function parseSpawns(
  chronicle: Chronicle = "interlude"
): Promise<Spawn[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  const { spawns, skipped } = parseSpawnFile(sources.spawnlistSqlFile);

  // Count distinct npcIds for the summary — useful context, and the first
  // step toward the future "attach spawns[] to NPC" feature.
  const byNpc = new Set<number>();
  for (const s of spawns) byNpc.add(s.npcId);

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "spawns.json"),
    JSON.stringify(spawns, null, 2)
  );

  console.log(`[parse-spawns] Done. (chronicle=${chronicle})`);
  console.log(`  File:             ${path.basename(sources.spawnlistSqlFile)}`);
  console.log(`  Spawn rows:       ${spawns.length}`);
  console.log(`  Distinct npcIds:  ${byNpc.size}`);
  console.log(`  Skipped:          ${skipped}`);

  return spawns;
}

// Run directly
if (require.main === module) {
  parseSpawns().catch(console.error);
}

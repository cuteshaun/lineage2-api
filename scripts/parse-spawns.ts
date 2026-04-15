import fs from "node:fs";
import path from "node:path";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import type { Chronicle } from "../src/lib/chronicles";
import type { Spawn } from "../src/lib/types";
import { getChronicleSources } from "./chronicle-sources";

/**
 * Spawn parser.
 *
 * Two sources are merged into a single flat `Spawn[]` written to
 * `data/generated/<chronicle>/spawns.json`:
 *
 *   1. `spawnlist.sql`           — regular NPC/monster spawns
 *   2. `raidboss_spawnlist.sql`  — raid boss spawns
 *
 * Grand bosses (Antharas, Valakas, Baium, Sailren, Queen Ant, …) are
 * NOT in either file — aCis handles them via a hardcoded GrandBoss system
 * and a separate `grandboss_data` table which is runtime state, not static
 * spawn spec. Those remain returning `[]` from the spawn endpoints.
 *
 * Sibling files `spawnlist_4s.sql` and `random_spawn*.sql` are
 * intentionally left for later iterations — each needs distinct parsing
 * + join semantics that don't fit the current flat shape.
 *
 * --- Normalization decisions (raidboss_spawnlist.sql) ---
 *
 * The raid boss schema is:
 *   boss_id, loc_x, loc_y, loc_z, heading,
 *   spawn_time, random_time, respawn_time, currentHp, currentMp
 *
 * Mapped into the existing `Spawn` shape as:
 *   - boss_id     → npcId
 *   - loc_{x,y,z} → x, y, z
 *   - heading     → heading
 *   - spawn_time  → respawnDelay   (× 3600: source is in HOURS, we normalize to seconds)
 *   - random_time → respawnRandom  (× 3600: same unit conversion)
 *   - periodOfDay is absent in the source → default 0 ("Any")
 *   - respawn_time / currentHp / currentMp are runtime server state, dropped
 *
 * The unit conversion is the one real contract decision: `respawnDelay`
 * and `respawnRandom` are already in seconds everywhere else, so raid
 * boss rows are converted at parse time to keep the same semantics.
 * Without it, consumers seeing `respawnDelay: 36` would assume 36 seconds
 * when the source means 36 hours.
 */

/** Regular spawnlist.sql tuple: 8 single-quoted integers. */
const SPAWNLIST_TUPLE_RE =
  /^\(\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*,\s*'(-?\d+)'\s*\)\s*[,;]?\s*$/;

/**
 * raidboss_spawnlist.sql tuple: 10 UNQUOTED integers, optionally followed
 * by a trailing `-- name (level)` SQL comment. Anchored loosely so a
 * trailing comment is tolerated.
 */
const RAIDBOSS_TUPLE_RE =
  /^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(?:-?\d+|NULL)\s*,\s*(?:-?\d+|NULL)\s*\)\s*[,;]?\s*(?:--.*)?$/i;

function parseSpawnlistFile(absPath: string): {
  spawns: Spawn[];
  skipped: number;
} {
  if (!fs.existsSync(absPath)) {
    console.error(`[parse-spawns] SQL file not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const valuesIdx = raw.search(/\bVALUES\b/i);
  if (valuesIdx < 0) {
    console.error(
      `[parse-spawns] No VALUES keyword in ${absPath} — wrong file?`
    );
    process.exit(1);
  }

  const body = raw.slice(valuesIdx);
  const spawns: Spawn[] = [];
  let skipped = 0;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (!line.startsWith("(")) continue;
    if (line.startsWith("--")) continue;

    const m = SPAWNLIST_TUPLE_RE.exec(line);
    if (!m) {
      skipped++;
      console.warn(
        `[parse-spawns] Skipping malformed spawnlist tuple: ${line.slice(0, 120)}`
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

function parseRaidbossSpawnlistFile(absPath: string): {
  spawns: Spawn[];
  skipped: number;
} {
  if (!fs.existsSync(absPath)) {
    console.error(`[parse-spawns] SQL file not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf-8");
  const valuesIdx = raw.search(/\bVALUES\b/i);
  if (valuesIdx < 0) {
    console.error(
      `[parse-spawns] No VALUES keyword in ${absPath} — wrong file?`
    );
    process.exit(1);
  }

  const body = raw.slice(valuesIdx);
  const spawns: Spawn[] = [];
  let skipped = 0;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    // Commented-out tuples (`-- (25517, ...)`) and section-header comments
    // (`-- Following mobs ...`) both start with `--` — skip either.
    if (!line.startsWith("(")) continue;

    const m = RAIDBOSS_TUPLE_RE.exec(line);
    if (!m) {
      skipped++;
      console.warn(
        `[parse-spawns] Skipping malformed raidboss tuple: ${line.slice(0, 120)}`
      );
      continue;
    }

    // Normalize to the existing Spawn shape. See file-header comment for
    // the mapping rationale, especially the hours→seconds conversion on
    // respawnDelay and respawnRandom.
    const spawnTimeHours = Number(m[6]);
    const randomTimeHours = Number(m[7]);
    spawns.push({
      npcId: Number(m[1]),
      x: Number(m[2]),
      y: Number(m[3]),
      z: Number(m[4]),
      heading: Number(m[5]),
      respawnDelay: spawnTimeHours * 3600,
      respawnRandom: randomTimeHours * 3600,
      periodOfDay: 0,
    });
  }

  return { spawns, skipped };
}

export async function parseSpawns(
  chronicle: Chronicle = "interlude"
): Promise<Spawn[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  const regular = parseSpawnlistFile(sources.spawnlistSqlFile);
  const raidboss = parseRaidbossSpawnlistFile(sources.raidbossSpawnlistSqlFile);

  // Merge: regular spawns first (preserves existing order for any
  // downstream consumer that cared), raid-boss spawns appended after.
  const spawns: Spawn[] = [...regular.spawns, ...raidboss.spawns];

  const byNpc = new Set<number>();
  for (const s of spawns) byNpc.add(s.npcId);

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "spawns.json"),
    JSON.stringify(spawns, null, 2)
  );

  console.log(`[parse-spawns] Done. (chronicle=${chronicle})`);
  console.log(`  spawnlist.sql rows:           ${regular.spawns.length}`);
  console.log(`  raidboss_spawnlist.sql rows:  ${raidboss.spawns.length}`);
  console.log(`  Total spawn rows:             ${spawns.length}`);
  console.log(`  Distinct npcIds:              ${byNpc.size}`);
  console.log(
    `  Skipped:                      ${regular.skipped + raidboss.skipped}` +
      (regular.skipped || raidboss.skipped
        ? ` (spawnlist: ${regular.skipped}, raidboss: ${raidboss.skipped})`
        : "")
  );

  return spawns;
}

// Run directly
if (require.main === module) {
  parseSpawns().catch(console.error);
}

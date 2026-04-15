import fs from "node:fs";
import path from "node:path";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import type { Chronicle } from "../src/lib/chronicles";
import type { Spawn } from "../src/lib/types";
import { getChronicleSources } from "./chronicle-sources";

/**
 * Spawn parser.
 *
 * Three sources are merged into a single flat `Spawn[]` written to
 * `data/generated/<chronicle>/spawns.json`:
 *
 *   1. `spawnlist.sql`           — regular NPC/monster spawns
 *   2. `raidboss_spawnlist.sql`  — raid boss spawns
 *   3. `grandboss_data.sql`      — grand/epic boss canonical lair points
 *
 * `grandboss_data` is a hybrid table: each row carries both a static
 * lair coordinate AND runtime state (`respawn_time`, `currentHP/MP`,
 * `status`). Only the static location half is meaningful in the static
 * spawn model — the runtime columns are dropped here. Engine-driven
 * respawn timing (Antharas ~6d, Baium ~5d, etc.) lives in aCis Java
 * code, not SQL, so `respawnDelay`/`respawnRandom` default to 0 for
 * these rows. That means `0` here is "source is silent / engine-driven",
 * not "respawns instantly" — same soft caveat already applies to
 * raidboss rows where `spawn_time` is 0.
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

/**
 * grandboss_data.sql tuple: 9 unquoted integers
 * (boss_id, loc_x, loc_y, loc_z, heading, respawn_time, currentHP,
 *  currentMP, status), trailing `-- name` comment tolerated. We only
 * capture the first five — the rest is runtime state we deliberately
 * drop. `currentHP`/`currentMP` may be `NULL` per the column default.
 */
const GRANDBOSS_TUPLE_RE =
  /^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*-?\d+\s*,\s*(?:-?\d+|NULL)\s*,\s*(?:-?\d+|NULL)\s*,\s*-?\d+\s*\)\s*[,;]?\s*(?:--.*)?$/i;

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

function parseGrandbossDataFile(absPath: string): {
  spawns: Spawn[];
  skipped: number;
  skippedSentinel: number;
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
  let skippedSentinel = 0;

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    if (line.length === 0) continue;
    if (!line.startsWith("(")) continue;

    const m = GRANDBOSS_TUPLE_RE.exec(line);
    if (!m) {
      skipped++;
      console.warn(
        `[parse-spawns] Skipping malformed grandboss tuple: ${line.slice(0, 120)}`
      );
      continue;
    }

    const npcId = Number(m[1]);
    const x = Number(m[2]);
    const y = Number(m[3]);
    const z = Number(m[4]);
    const heading = Number(m[5]);

    // Skip Frintezza-style sentinel rows: `(npcId, 0, 0, 0, …)` is not a
    // real world coordinate. In Interlude this is Frintezza (29045),
    // who is instanced — there's no fixed lair pin to expose.
    if (x === 0 && y === 0 && z === 0) {
      skippedSentinel++;
      continue;
    }

    // Static lair only. The runtime fields we matched but discarded
    // (`respawn_time`, `currentHP`, `currentMP`, `status`) have no
    // home in the static `Spawn` shape and are intentionally dropped.
    spawns.push({
      npcId,
      x,
      y,
      z,
      heading,
      respawnDelay: 0,
      respawnRandom: 0,
      periodOfDay: 0,
    });
  }

  return { spawns, skipped, skippedSentinel };
}

export async function parseSpawns(
  chronicle: Chronicle = "interlude"
): Promise<Spawn[]> {
  const dataConfig = getChronicleDataConfig(chronicle);
  const sources = getChronicleSources(chronicle);

  const regular = parseSpawnlistFile(sources.spawnlistSqlFile);
  const raidboss = parseRaidbossSpawnlistFile(sources.raidbossSpawnlistSqlFile);
  const grandboss = parseGrandbossDataFile(sources.grandbossDataSqlFile);

  // Merge: regular spawns first (preserves existing order for any
  // downstream consumer that cared), then raid-boss spawns, then
  // grand-boss lair points appended last.
  const spawns: Spawn[] = [
    ...regular.spawns,
    ...raidboss.spawns,
    ...grandboss.spawns,
  ];

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
  console.log(
    `  grandboss_data.sql rows:      ${grandboss.spawns.length}` +
      (grandboss.skippedSentinel
        ? ` (skipped ${grandboss.skippedSentinel} sentinel ${
            grandboss.skippedSentinel === 1 ? "row" : "rows"
          } at (0,0,0))`
        : "")
  );
  console.log(`  Total spawn rows:             ${spawns.length}`);
  console.log(`  Distinct npcIds:              ${byNpc.size}`);
  const totalSkipped =
    regular.skipped + raidboss.skipped + grandboss.skipped;
  console.log(
    `  Skipped:                      ${totalSkipped}` +
      (totalSkipped
        ? ` (spawnlist: ${regular.skipped}, raidboss: ${raidboss.skipped}, grandboss: ${grandboss.skipped})`
        : "")
  );

  return spawns;
}

// Run directly
if (require.main === module) {
  parseSpawns().catch(console.error);
}

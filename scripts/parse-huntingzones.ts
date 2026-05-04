/**
 * Parses `huntingzone-e.dat` from the L2 client into a flat catalog
 * of player-facing hunting / map area names with center anchors,
 * emitted as `data/generated/<chronicle>/huntingzones.json`. M7
 * Stage 1 source.
 *
 * The DAT envelope is the well-known `Lineage2Ver413` RSA + zlib
 * format — handled by the shared `decodeVer413()` helper. The
 * decoded body is a fixed-pitch record stream:
 *
 *   uint32 LE recordCount
 *   N records of:
 *     uint32 LE id           // 1..N
 *     uint32 LE type         // 0..7, semantics not fully decoded
 *     uint32 LE minLevel     // recommended min player level (0 = unspecified)
 *     uint32 LE reserved     // always 0
 *     float32 LE x           // center X (0 for territory catch-alls)
 *     float32 LE y           // center Y
 *     float32 LE z           // center Z
 *     uint8     separator    // always 0x00
 *     uint32 LE flag         // always 1 (or 0 for record 1)
 *     uint8 nameLen + ASCII (length includes trailing \0)
 *
 * The file ends with a small trailer byte sequence ("Safe@" sentinel
 * + zero padding) that does not parse as a record.
 *
 * **Territory catch-alls** (records with x = y = z = 0, e.g.
 * "Dion Territory", "Aden Territory", "Border", "Dimensional Rift")
 * are intentionally **dropped at parse time**. Rationale: their
 * names overlap the M4 `mapRegions.xml` 19-region table that we
 * already surface as `primaryRegion?`, and they have no spatial
 * anchor for nearest-coordinate resolution. Keeping the catalog
 * focused on resolvable player-facing locations matches the user's
 * default preference for Stage 1.
 *
 * Behavior gating mirrors `parse-questname.ts` and `parse-regions.ts`:
 *   - Configured + present → emit `huntingzones.json`.
 *   - Configured + missing/unreadable/undecodable → exit 1 loud.
 *   - Not configured → caller skips; defensive `null` return.
 */

import fs from "node:fs";
import path from "node:path";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleDataConfig } from "../src/lib/chronicle-config";
import { getChronicleSources } from "./chronicle-sources";
import { decodeVer413 } from "./lib/ver413";
import type { HuntingZone } from "../src/lib/types";

/**
 * Each record's fixed-size header before the variable-length name.
 * Bytes 0..27 are 7 × uint32 (id, type, minLevel, reserved, X, Y, Z
 * with the last 3 reinterpreted as float32). Byte 28 is a separator
 * (always 0x00). Bytes 29..32 are a uint32 flag (always 1 except
 * for the first territory record which carries 0). Byte 33 is the
 * name length prefix.
 */
const HEADER_SIZE = 33;

interface ParsedRecord {
  id: number;
  type: number;
  minLevel: number;
  x: number;
  y: number;
  z: number;
  name: string;
}

function parseRecords(buf: Buffer): ParsedRecord[] {
  if (buf.length < 4) {
    throw new Error("[parse-huntingzones] decoded body too short for header");
  }
  const declaredCount = buf.readUInt32LE(0);
  const out: ParsedRecord[] = [];
  let pos = 4;
  while (pos + HEADER_SIZE + 1 <= buf.length) {
    const id = buf.readUInt32LE(pos);
    const type = buf.readUInt32LE(pos + 4);
    const minLevel = buf.readUInt32LE(pos + 8);
    const x = buf.readFloatLE(pos + 16);
    const y = buf.readFloatLE(pos + 20);
    const z = buf.readFloatLE(pos + 24);
    const nameLen = buf[pos + HEADER_SIZE];
    if (nameLen < 2) break; // trailer / sentinel
    const bodyStart = pos + HEADER_SIZE + 1;
    const bodyEnd = bodyStart + nameLen;
    if (bodyEnd > buf.length) break;
    if (buf[bodyEnd - 1] !== 0) break; // body must end with \0
    let asciiOk = true;
    for (let i = bodyStart; i < bodyEnd - 1; i++) {
      const b = buf[i];
      if (b < 0x20 || b > 0x7e) {
        asciiOk = false;
        break;
      }
    }
    if (!asciiOk) break;
    const name = buf.subarray(bodyStart, bodyEnd - 1).toString("latin1");
    out.push({ id, type, minLevel, x, y, z, name });
    pos = bodyEnd;
  }
  if (out.length === 0) {
    throw new Error(
      "[parse-huntingzones] decoded body parsed to zero records — DAT may be corrupt or use a different schema"
    );
  }
  // The declared count occasionally includes a trailing sentinel that we
  // legitimately drop ("Safe@"); we don't fail the build over a tiny
  // mismatch but we DO surface it in the summary so a real corruption
  // shows up.
  if (Math.abs(out.length - declaredCount) > 1) {
    throw new Error(
      `[parse-huntingzones] declared count ${declaredCount} but parsed ${out.length} records — schema mismatch`
    );
  }
  return out;
}

/**
 * Build-time entry point. Decodes `huntingzone-e.dat`, drops
 * territory catch-alls (x=y=z=0), and emits
 * `data/generated/<chronicle>/huntingzones.json` keyed by the
 * source DAT id.
 *
 * Returns the kept (spatial) hunting zones; or `null` when the
 * chronicle didn't configure the source.
 */
export async function parseHuntingZones(
  chronicle: Chronicle = "interlude"
): Promise<HuntingZone[] | null> {
  const sources = getChronicleSources(chronicle);
  const dataConfig = getChronicleDataConfig(chronicle);

  if (!sources.huntingZoneDatFile) return null;

  if (!fs.existsSync(sources.huntingZoneDatFile)) {
    console.error(
      `[parse-huntingzones] huntingZoneDatFile is configured but missing: ${sources.huntingZoneDatFile}`
    );
    process.exit(1);
  }

  const decoded = await decodeVer413(
    sources.huntingZoneDatFile,
    "[parse-huntingzones]"
  );
  const all = parseRecords(decoded);

  // Drop territory catch-alls (x=y=z=0). Their names overlap M4's
  // mapRegions.xml table and they have no spatial anchor.
  const dropped: ParsedRecord[] = [];
  const spatial: HuntingZone[] = [];
  for (const rec of all) {
    if (rec.x === 0 && rec.y === 0 && rec.z === 0) {
      dropped.push(rec);
    } else {
      spatial.push({
        id: rec.id,
        type: rec.type,
        minLevel: rec.minLevel,
        x: rec.x,
        y: rec.y,
        z: rec.z,
        name: rec.name,
      });
    }
  }

  spatial.sort((a, b) => a.id - b.id);

  fs.mkdirSync(dataConfig.generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataConfig.generatedDir, "huntingzones.json"),
    JSON.stringify(spatial, null, 2)
  );

  console.log(`[parse-huntingzones] Done. (chronicle=${chronicle})`);
  console.log(`  Records parsed:        ${all.length}`);
  console.log(`  Spatial (kept):        ${spatial.length}`);
  console.log(
    `  Territory catch-alls:  ${dropped.length} (dropped — overlap with mapRegions)`
  );
  if (dropped.length > 0) {
    const names = dropped.map((d) => d.name).join(", ");
    console.log(`    dropped: ${names}`);
  }

  return spatial;
}

if (require.main === module) {
  parseHuntingZones("interlude").catch((err) => {
    console.error("[parse-huntingzones] fatal:", err);
    process.exit(1);
  });
}

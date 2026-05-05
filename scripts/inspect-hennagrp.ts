/**
 * Local dev-only inspector for `hennagrp-e.dat`. Decodes the
 * Lineage2Ver413 envelope, walks the record table in-memory, and
 * prints record-shape and cardinality stats.
 *
 * Usage:
 *   pnpm exec tsx scripts/inspect-hennagrp.ts
 *
 * NOT wired into `pnpm build:data`. Companion to
 * `scripts/parse-hennas.ts` which performs the production join with
 * `hennas.xml`.
 */
import fs from "node:fs";
import path from "node:path";
import { decodeVer413 } from "./lib/ver413";

interface HennaGrpRecord {
  symbolId: number;
  dyeItemId: number;
  displayName: string;
  iconFile: string;
  shortLabel: string;
  longLabel: string;
}

function readU8PrefixedAscii(buf: Buffer, off: number): { s: string; next: number } {
  const len = buf.readUInt8(off);
  const bytes = buf.subarray(off + 1, off + 1 + len);
  return { s: bytes.toString("ascii").replace(/\0+$/, ""), next: off + 1 + len };
}

async function main(): Promise<void> {
  const datPath = path.join(
    "data",
    "datapack",
    "interlude",
    "hennagrp-e.dat"
  );
  if (!fs.existsSync(datPath)) {
    console.error(`[inspect-hennagrp] file not found: ${datPath}`);
    process.exit(1);
  }
  const decoded = await decodeVer413(datPath, "[inspect-hennagrp]");

  // Hex tail dump (debug)
  console.log("HEX TAIL @ 14800..end:");
  for (let i = 14800; i < decoded.length; i += 32) {
    const slice = decoded.subarray(i, Math.min(i + 32, decoded.length));
    const h = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const a = [...slice].map((b) => (b >= 0x20 && b < 0x7f) ? String.fromCharCode(b) : ".").join("");
    console.log("@" + i.toString().padStart(5) + "  " + h.padEnd(96) + "  |" + a + "|");
  }
  console.log();

  const records: HennaGrpRecord[] = [];
  let p = 0;
  const recordCount = decoded.readUInt32LE(p);
  p += 4;
  for (let i = 0; i < recordCount; i++) {
    if (p + 8 > decoded.length) {
      console.log(`  STOPPED at record ${i}, p=${p}: not enough bytes for next id+dye`);
      break;
    }
    const start = p;
    const symbolId = decoded.readUInt32LE(p); p += 4;
    const dyeItemId = decoded.readUInt32LE(p); p += 4;
    const a = readU8PrefixedAscii(decoded, p); p = a.next;
    const b = readU8PrefixedAscii(decoded, p); p = b.next;
    const c = readU8PrefixedAscii(decoded, p); p = c.next;
    const d = readU8PrefixedAscii(decoded, p); p = d.next;
    records.push({
      symbolId,
      dyeItemId,
      displayName: a.s,
      iconFile: b.s,
      shortLabel: c.s,
      longLabel: d.s,
    });
    if (i < 3 || (i >= 35 && i <= 38) || i > 165) {
      console.log(`  rec ${i} sym=${symbolId} dye=${dyeItemId} name=${JSON.stringify(a.s.slice(0, 40))} icon=${JSON.stringify(b.s.slice(0, 40))} short=${JSON.stringify(c.s.slice(0, 30))}`);
      console.log(`    bytes [${start}..${p}], len=${p - start}`);
    }
  }

  console.log(`[inspect-hennagrp] Decoded.`);
  console.log(`  Source:           ${datPath}`);
  console.log(`  Decoded size:     ${decoded.length} bytes`);
  console.log(`  Records:          ${records.length}`);
  console.log(`  Bytes consumed:   ${p} / ${decoded.length}`);
  console.log();

  // Cardinality of dyeItemId
  const dyeBuckets = new Map<number, HennaGrpRecord[]>();
  for (const r of records) {
    const arr = dyeBuckets.get(r.dyeItemId) ?? [];
    arr.push(r);
    dyeBuckets.set(r.dyeItemId, arr);
  }
  const distinctDyes = dyeBuckets.size;
  const collisions = [...dyeBuckets.entries()].filter(([, a]) => a.length > 1);
  console.log(`  Distinct dyeItemIds:                  ${distinctDyes}`);
  console.log(`  dyeItemIds shared by >1 symbol:        ${collisions.length}`);
  if (collisions.length > 0) {
    console.log(`  Sample collisions (first 5):`);
    for (const [dye, arr] of collisions.slice(0, 5)) {
      console.log(`    dye=${dye}:`);
      for (const r of arr) {
        console.log(
          `      symbol=${r.symbolId} name=${JSON.stringify(r.displayName)} short=${JSON.stringify(r.shortLabel)}`
        );
      }
    }
  }
  console.log();

  // First 5 / last 5
  console.log(`  First 5 records:`);
  for (const r of records.slice(0, 5)) {
    console.log(`    ${JSON.stringify(r)}`);
  }
  console.log();
  console.log(`  Last 5 records:`);
  for (const r of records.slice(-5)) {
    console.log(`    ${JSON.stringify(r)}`);
  }
}

main().catch((err) => {
  console.error("[inspect-hennagrp] fatal:", err);
  process.exit(1);
});

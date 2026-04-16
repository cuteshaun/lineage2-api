/**
 * One-off audit: extract authoritative itemId -> iconName mappings from the
 * three Lineage 2 Interlude *grp.dat client tables:
 *
 *   data/datapack/interlude/etcitemgrp.dat   → icon.etc_<name>_i00
 *   data/datapack/interlude/weapongrp.dat    → icon.weapon_<name>_i00
 *   data/datapack/interlude/armorgrp.dat     → icon.armor_<name>_i00
 *
 * Exploratory only — NOT wired into build-data.ts and does NOT touch any
 * production parser. Purpose is to confirm we can recover mappings from the
 * grp files deterministically and to produce sample rows for review.
 *
 * File format (observed from raw bytes, verified on records 0–1 of each):
 *   - outer envelope is the same as itemname-e.dat: Lineage2Ver413 header +
 *     128-byte RSA-encrypted blocks + 20-byte trailer.
 *   - these three files use the ORIGINAL RSA key (exp 0x35), unlike
 *     itemname-e.dat which uses the MODIFIED key (exp 0x1d).
 *   - decrypted payload is `uint32 uncompLen` + zlib stream.
 *   - inflated body begins with `uint32 recordCount`, then record bytes.
 *   - every record begins with 7 × int32, where `itemId = int32 at +4`.
 *     (rec0 itemIds: etcitemgrp=17 Wooden Arrow, weapongrp=1 Short Sword,
 *     armorgrp=21 Shirt — all match data/generated/interlude/items.json.)
 *   - after the 7-int header, records contain variable-length ustring fields
 *     (int32 byte-length + UTF-16LE bytes, no null terminator) interleaved
 *     with more int32 fields. The record body schema varies per file and
 *     has not been fully pinned down — on purpose, we avoid schema walking.
 *
 * Extraction strategy (deterministic, no fuzzy matching):
 *   1. Scan the decoded buffer for every UTF-16LE ustring.
 *   2. Identify record-start (mesh) ustrings: a ustring U qualifies if
 *      `u32(U.off - 24)` is a valid itemId for the current grp's category
 *      (from items.json) AND `u32(U.off - 28)` is a plausibly small tag
 *      (< 100). This anchors record boundaries without guessing body schema.
 *   3. For each record [mesh_i, mesh_{i+1}), find the first ustring matching
 *      `^icon\..+_i00$` and pair it with this record's itemId. Each grp
 *      file mixes icon sub-prefixes (armorgrp contains icon.armor_*,
 *      icon.accessary_*, icon.accessory_*, icon.shield_*, …; weapongrp
 *      contains icon.weapon_*, icon.shield_*, …), so we do not constrain
 *      by sub-prefix — only one icon per record is the "primary" one.
 *
 * Output: prints a small sample and writes a JSON dump next to the decoded
 * bins for later manual review. No API code is modified.
 *
 * Run: `pnpm tsx scripts/audit/map-item-icons-grp.ts`
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// --- shared Ver413 RSA+zlib decode (same constants as decode-itemname-dat.ts) ---
const MOD_MODIFIED_B64 =
  "dbTW3lwBZUQGihrPElhp9D0uCfxVuLHiiVVtr5uHV2NVk0RiiLNlPaHOkch7saXBjxYyNJXFXX1ywIkKg/ab/R/ZQ06xwC8+Rnnt+kMwkxkHASnCZ8hWBNh7tluuIF3jcHrx0hCIgau1Z8Oz0GmuZ8OkxqOqk9JkE9TGYJSuIDk=";
const MOD_ORIGINAL_B64 =
  "l985hHLd9zfvCgzRfo0XLw/vFmGjiorh1ugpvBxuTDz8GSkt2p75AXXkbnOUoYhQtkF9A75u6idNPtHd5bXXvecswKC3HQNghlVjOIF5OgLJpn2e8rRet8CNS+MpCDzkUOaPeGe2dJMU1AUR0JvFdEVRuqhqidw4Ej3BZo/XLYM=";
const EXP_MODIFIED = 0x1dn;
const EXP_ORIGINAL = 0x35n;

const HEADER = "Lineage2Ver413";
const HEADER_BYTES = HEADER.length * 2;
const BLOCK = 128;

function bytesToBigInt(buf: Buffer): bigint {
  let n = 0n;
  for (const b of buf) n = (n << 8n) | BigInt(b);
  return n;
}
function bigIntToBytes(n: bigint, byteLen: number): Buffer {
  const out = Buffer.alloc(byteLen);
  for (let i = byteLen - 1; i >= 0 && n > 0n; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let r = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) r = (r * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return r;
}
function rsaDecryptBlocks(
  cipher: Buffer,
  modBytes: Buffer,
  exp: bigint
): Buffer | null {
  const mod = bytesToBigInt(modBytes);
  const chunks: Buffer[] = [];
  const usable = cipher.length - (cipher.length % BLOCK);
  for (let off = 0; off < usable; off += BLOCK) {
    const plain = bigIntToBytes(
      modPow(bytesToBigInt(cipher.subarray(off, off + BLOCK)), exp, mod),
      BLOCK
    );
    const size = plain.readUInt32BE(0);
    if (size > BLOCK - 4) return null; // wrong key sentinel
    chunks.push(plain.subarray(4, 4 + size));
  }
  return chunks.length ? Buffer.concat(chunks) : null;
}

async function tolerantInflate(input: Buffer): Promise<Buffer> {
  // Inflate but don't throw on trailing truncation (the 20-byte Ver413 signature
  // trailer sometimes makes the last zlib block report "unexpected end of file"
  // even though the meaningful body has already been produced).
  return new Promise((resolve) => {
    const z = zlib.createInflate();
    const parts: Buffer[] = [];
    z.on("data", (c: Buffer) => parts.push(c));
    z.on("error", () => {});
    z.on("close", () => resolve(Buffer.concat(parts)));
    z.end(input);
  });
}

async function decodeVer413(inPath: string): Promise<Buffer> {
  const buf = fs.readFileSync(inPath);
  const head = buf.subarray(0, HEADER_BYTES).toString("utf16le");
  if (head !== HEADER) throw new Error(`bad header in ${inPath}`);
  const cipher = buf.subarray(HEADER_BYTES);
  const modMod = Buffer.from(MOD_MODIFIED_B64, "base64");
  const modOrig = Buffer.from(MOD_ORIGINAL_B64, "base64");
  let concat = rsaDecryptBlocks(cipher, modMod, EXP_MODIFIED);
  if (!concat) concat = rsaDecryptBlocks(cipher, modOrig, EXP_ORIGINAL);
  if (!concat) throw new Error(`both RSA keys failed for ${inPath}`);
  // Skip the 4-byte LE uncompressed-length prefix, inflate the rest.
  return tolerantInflate(concat.subarray(4));
}

// --- ustring scanner ---

type Ustring = { off: number; end: number; s: string };

function scanUtf16Ustrings(buf: Buffer): Ustring[] {
  const hits: Ustring[] = [];
  for (let i = 0; i + 8 <= buf.length; i++) {
    const n = buf.readInt32LE(i);
    if (n < 4 || n > 256 || (n & 1) !== 0) continue;
    const end = i + 4 + n;
    if (end > buf.length) continue;
    let good = true;
    for (let j = i + 4; j < end; j += 2) {
      const lo = buf[j];
      const hi = buf[j + 1];
      if (hi > 1) {
        good = false;
        break;
      }
      if (lo < 0x20 && lo !== 0) {
        good = false;
        break;
      }
    }
    if (!good) continue;
    const s = buf.subarray(i + 4, end).toString("utf16le").replace(/\0+$/, "");
    if (s.length < 3) continue;
    if (!/^[A-Za-z0-9_.\- ]+$/.test(s)) continue;
    hits.push({ off: i, end, s });
    i = end - 1;
  }
  return hits;
}

// --- audit ---

type ItemsRecord = { id: number; name: string; type: string };

type Mapping = {
  itemId: number;
  iconName: string; // the part after "icon."  (e.g. "etc_adena_i00")
  sourceFile: string;
  itemName: string | null;
  itemType: string | null;
};

function extractMappings(
  decoded: Buffer,
  sourceFile: string,
  validIds: Set<number>
): { mappings: Mapping[]; recordsSeen: number } {
  // Accept any ustring in the "icon." namespace. Most end in _i00 but some
  // records use _i01 / _i02 / other suffixes; constraining to _i00 drops
  // legitimate entries. The "first icon ustring per record" is the primary.
  const iconRe = /^icon\.[A-Za-z]+_/;
  const ustrings = scanUtf16Ustrings(decoded);

  // Identify record-start (mesh) ustrings by validating the 7-int32 record
  // header that precedes each one: offset-24 must be a valid itemId for this
  // category, offset-28 must be a small tag, and the previous ustring (if
  // any) must have ended strictly before the header begins (otherwise the
  // candidate is an "inner" ustring whose preceding 28 bytes overlap the
  // previous ustring's content).
  type Record = { itemId: number; meshIdx: number };
  const records: Record[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < ustrings.length; i++) {
    const U = ustrings[i];
    if (U.off < 28) continue;
    const tag = decoded.readUInt32LE(U.off - 28);
    const id = decoded.readUInt32LE(U.off - 24);
    if (tag >= 100) continue;
    if (!validIds.has(id)) continue;
    if (iconRe.test(U.s)) continue; // a mesh is never itself an icon
    const prev = ustrings[i - 1];
    if (prev && prev.end > U.off - 28) continue;
    // Each itemId has exactly one record per grp file; ignore duplicate
    // anchors (they are false positives where an inner ustring coincidentally
    // has a valid itemId at -24 with no overlapping predecessor).
    if (seen.has(id)) continue;
    seen.add(id);
    records.push({ itemId: id, meshIdx: i });
  }

  const out: Mapping[] = [];
  for (let r = 0; r < records.length; r++) {
    const { itemId, meshIdx } = records[r];
    const nextMeshIdx =
      r + 1 < records.length ? records[r + 1].meshIdx : ustrings.length;
    for (let k = meshIdx + 1; k < nextMeshIdx; k++) {
      if (iconRe.test(ustrings[k].s)) {
        out.push({
          itemId,
          iconName: ustrings[k].s.replace(/^icon\./, ""),
          sourceFile,
          itemName: null,
          itemType: null,
        });
        break; // take only the first icon per record
      }
    }
  }
  return { mappings: out, recordsSeen: records.length };
}

async function main(): Promise<void> {
  const root = process.cwd();
  const dir = path.join(root, "data", "datapack", "interlude");

  const items: ItemsRecord[] = JSON.parse(
    fs.readFileSync(
      path.join(root, "data", "generated", "interlude", "items.json"),
      "utf-8"
    )
  );
  const byId = new Map<number, ItemsRecord>();
  for (const it of items) byId.set(it.id, it);
  const idsByType = (t: string) =>
    new Set(items.filter((x) => x.type === t).map((x) => x.id));

  const files = [
    { name: "etcitemgrp.dat", type: "etcitem" },
    { name: "weapongrp.dat", type: "weapon" },
    { name: "armorgrp.dat", type: "armor" },
  ];

  const allMappings: Mapping[] = [];
  for (const f of files) {
    const inPath = path.join(dir, f.name);
    const decoded = await decodeVer413(inPath);
    const recordCount = decoded.readUInt32LE(0);
    const validIds = idsByType(f.type);
    const { mappings, recordsSeen } = extractMappings(
      decoded,
      f.name,
      validIds
    );
    for (const m of mappings) {
      const it = byId.get(m.itemId);
      if (it) {
        m.itemName = it.name;
        m.itemType = it.type;
      }
    }
    allMappings.push(...mappings);
    console.log(
      `[${f.name}] inflated=${decoded.length}B declaredRecords=${recordCount} recordsAnchored=${recordsSeen} iconsMapped=${mappings.length} uniqueIds=${new Set(mappings.map((m) => m.itemId)).size}`
    );
  }

  console.log("\n--- sample mappings (first 10 overall) ---");
  for (const m of allMappings.slice(0, 10)) {
    console.log(
      `  { itemId: ${m.itemId}, iconName: ${JSON.stringify(m.iconName)}, sourceFile: ${JSON.stringify(m.sourceFile)} }  // ${m.itemName} [${m.itemType}]`
    );
  }

  // Spot-check specific ids the user asked about.
  const spotChecks = [1, 17, 57, 848, 1341, 2372, 6577];
  console.log("\n--- spot-checks for known items ---");
  for (const id of spotChecks) {
    const hit = allMappings.find((m) => m.itemId === id);
    const it = byId.get(id);
    if (hit) {
      console.log(
        `  id=${id.toString().padStart(5)} ${JSON.stringify(it?.name ?? "?")}  [${it?.type}]  →  ${hit.iconName}   (${hit.sourceFile})`
      );
    } else {
      console.log(
        `  id=${id.toString().padStart(5)} ${JSON.stringify(it?.name ?? "?")}  [${it?.type}]  →  (no mapping found)`
      );
    }
  }

  const outPath = path.join(dir, "item-icons-grp.audit.json");
  fs.writeFileSync(outPath, JSON.stringify(allMappings, null, 2), "utf-8");
  console.log(
    `\n[map-item-icons-grp] wrote ${allMappings.length} mappings → ${path.relative(root, outPath)}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

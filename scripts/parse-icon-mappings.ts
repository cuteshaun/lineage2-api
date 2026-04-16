/**
 * Extracts authoritative `itemId → iconName` mappings from the three
 * encrypted L2 client tables (etcitemgrp / weapongrp / armorgrp) for a
 * given chronicle.
 *
 * The outer envelope is the well-known `Lineage2Ver413` RSA + zlib format.
 * Two public RSA parameter sets exist; `itemname-e.dat` uses the "modified"
 * key (exp 0x1d), while the three `*grp.dat` tables use the "original" key
 * (exp 0x35). We try both.
 *
 * Inside each decoded body:
 *   - uint32 recordCount
 *   - packed records, each starting with 7 × int32 where `itemId` sits at
 *     offset +4 (verified against items.json: etcitemgrp rec0=17 Wooden
 *     Arrow, weapongrp rec0=1 Short Sword, armorgrp rec0=21 Shirt).
 *   - the first ustring after the 7-int header is the record's mesh path.
 *
 * We deliberately do not walk the variable body schema. Instead we anchor
 * records by finding every ustring U whose preceding 28-byte header has
 *   u32(U.off - 28) < 100              (a plausibly small tag field)
 *   u32(U.off - 24) ∈ validItemIds      (a real item of the right category)
 * and whose prior ustring ends before U.off - 28 (so we reject inner
 * ustrings whose preceding 28 bytes overlap a real string). Between two
 * consecutive record anchors, the first ustring matching `^icon\.[A-Za-z]+_`
 * is taken as that record's primary icon. No fuzzy matching, no name
 * heuristics — items without a grp match stay `null`.
 */

import fs from "node:fs";
import zlib from "node:zlib";
import type { Chronicle } from "../src/lib/chronicles";
import { getChronicleSources } from "./chronicle-sources";
import type { Item } from "../src/lib/types";

// --- Ver413 RSA public parameter sets (well-known, community docs) ---
const MOD_MODIFIED_B64 =
  "dbTW3lwBZUQGihrPElhp9D0uCfxVuLHiiVVtr5uHV2NVk0RiiLNlPaHOkch7saXBjxYyNJXFXX1ywIkKg/ab/R/ZQ06xwC8+Rnnt+kMwkxkHASnCZ8hWBNh7tluuIF3jcHrx0hCIgau1Z8Oz0GmuZ8OkxqOqk9JkE9TGYJSuIDk=";
const MOD_ORIGINAL_B64 =
  "l985hHLd9zfvCgzRfo0XLw/vFmGjiorh1ugpvBxuTDz8GSkt2p75AXXkbnOUoYhQtkF9A75u6idNPtHd5bXXvecswKC3HQNghlVjOIF5OgLJpn2e8rRet8CNS+MpCDzkUOaPeGe2dJMU1AUR0JvFdEVRuqhqidw4Ej3BZo/XLYM=";
const EXP_MODIFIED = 0x1dn;
const EXP_ORIGINAL = 0x35n;

const FILE_HEADER = "Lineage2Ver413";
const FILE_HEADER_BYTES = FILE_HEADER.length * 2; // UTF-16LE
const RSA_BLOCK = 128;

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
  // Trim the 20-byte signature trailer that Ver413 dumps append after the
  // last full RSA block.
  const usable = cipher.length - (cipher.length % RSA_BLOCK);
  for (let off = 0; off < usable; off += RSA_BLOCK) {
    const plain = bigIntToBytes(
      modPow(
        bytesToBigInt(cipher.subarray(off, off + RSA_BLOCK)),
        exp,
        mod
      ),
      RSA_BLOCK
    );
    const size = plain.readUInt32BE(0);
    // With the wrong key the first 4 bytes decode to a large garbage uint —
    // they are then used as a sentinel to fall through to the next key.
    if (size > RSA_BLOCK - 4) return null;
    chunks.push(plain.subarray(4, 4 + size));
  }
  return chunks.length ? Buffer.concat(chunks) : null;
}

async function tolerantInflate(input: Buffer): Promise<Buffer> {
  // Ver413 signature-trailer truncation makes the last zlib block report
  // "unexpected end of file" even though every meaningful byte decoded. We
  // swallow the terminal error and return whatever was produced.
  return new Promise((resolve) => {
    const z = zlib.createInflate();
    const parts: Buffer[] = [];
    z.on("data", (c: Buffer) => parts.push(c));
    z.on("error", () => {});
    z.on("close", () => resolve(Buffer.concat(parts)));
    z.end(input);
  });
}

async function decodeVer413(datPath: string): Promise<Buffer> {
  const buf = fs.readFileSync(datPath);
  const head = buf.subarray(0, FILE_HEADER_BYTES).toString("utf16le");
  if (head !== FILE_HEADER) {
    throw new Error(
      `[parse-icon-mappings] unexpected Ver413 header in ${datPath}: ${JSON.stringify(head)}`
    );
  }
  const cipher = buf.subarray(FILE_HEADER_BYTES);
  const modModified = Buffer.from(MOD_MODIFIED_B64, "base64");
  const modOriginal = Buffer.from(MOD_ORIGINAL_B64, "base64");

  let concat = rsaDecryptBlocks(cipher, modModified, EXP_MODIFIED);
  if (!concat) concat = rsaDecryptBlocks(cipher, modOriginal, EXP_ORIGINAL);
  if (!concat) {
    throw new Error(
      `[parse-icon-mappings] both RSA parameter sets failed for ${datPath}`
    );
  }
  // Decoded payload is `uint32 uncompLen` + zlib-deflate of UTF-16LE body.
  return tolerantInflate(concat.subarray(4));
}

// --- body parsing ---

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

const ICON_USTRING_RE = /^icon\.[A-Za-z]+_/;

function extractMappingsFromBuffer(
  decoded: Buffer,
  validIds: Set<number>
): Map<number, string> {
  const ustrings = scanUtf16Ustrings(decoded);

  // 1. Anchor each record by finding its mesh ustring.
  type Anchor = { itemId: number; meshIdx: number };
  const anchors: Anchor[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < ustrings.length; i++) {
    const u = ustrings[i];
    if (u.off < 28) continue;
    const tag = decoded.readUInt32LE(u.off - 28);
    if (tag >= 100) continue;
    const id = decoded.readUInt32LE(u.off - 24);
    if (!validIds.has(id)) continue;
    if (ICON_USTRING_RE.test(u.s)) continue; // mesh is never an icon
    const prev = ustrings[i - 1];
    if (prev && prev.end > u.off - 28) continue; // 28-byte header must not overlap previous string
    if (seen.has(id)) continue; // itemIds are unique per grp file; dedupe false positives
    seen.add(id);
    anchors.push({ itemId: id, meshIdx: i });
  }

  // 2. Between consecutive anchors, take the first icon ustring.
  const out = new Map<number, string>();
  for (let r = 0; r < anchors.length; r++) {
    const { itemId, meshIdx } = anchors[r];
    const nextMeshIdx =
      r + 1 < anchors.length ? anchors[r + 1].meshIdx : ustrings.length;
    for (let k = meshIdx + 1; k < nextMeshIdx; k++) {
      if (ICON_USTRING_RE.test(ustrings[k].s)) {
        out.set(itemId, ustrings[k].s.replace(/^icon\./, ""));
        break;
      }
    }
  }
  return out;
}

// --- public API ---

/**
 * Returns a map of `itemId → iconName` (e.g. 57 → "etc_adena_i00") drawn
 * from the chronicle's three `*grp.dat` tables. Callers then resolve each
 * `iconName` to a file on disk via {@link resolveIconFile}.
 */
export async function parseIconMappings(
  chronicle: Chronicle,
  allItems: Item[]
): Promise<Map<number, string>> {
  const sources = getChronicleSources(chronicle);

  // Client-side grp categories do not match the server-side `type` field
  // 1-to-1 (e.g. shields are server `type="armor"` but live in weapongrp;
  // accessories likewise straddle armorgrp). itemIds are globally unique
  // across all three grp files, so we validate each record anchor against
  // the full set of known ids instead of a per-type subset.
  const allValidIds = new Set(allItems.map((i) => i.id));

  const jobs: { label: string; path: string }[] = [
    { label: "etcitemgrp", path: sources.clientGrpFiles.etcitem },
    { label: "weapongrp", path: sources.clientGrpFiles.weapon },
    { label: "armorgrp", path: sources.clientGrpFiles.armor },
  ];

  const merged = new Map<number, string>();
  for (const job of jobs) {
    if (!fs.existsSync(job.path)) {
      console.warn(
        `[parse-icon-mappings] missing grp file for ${job.label}: ${job.path} — skipping`
      );
      continue;
    }
    const decoded = await decodeVer413(job.path);
    const mappings = extractMappingsFromBuffer(decoded, allValidIds);
    for (const [id, iconName] of mappings) {
      // itemId is unique per grp file but an item *could* theoretically
      // appear across files (e.g. if categories overlap). First writer wins.
      if (!merged.has(id)) merged.set(id, iconName);
    }
  }
  return merged;
}

/**
 * Builds a case-insensitive index of PNG basenames present in the chronicle's
 * icons directory. Exported so {@link parseItems} can resolve `iconName` →
 * `iconFile` without re-reading the directory.
 */
export function buildIconFileIndex(iconsDir: string): Map<string, string> {
  const index = new Map<string, string>();
  if (!fs.existsSync(iconsDir)) return index;
  for (const entry of fs.readdirSync(iconsDir)) {
    if (!entry.toLowerCase().endsWith(".png")) continue;
    index.set(entry.toLowerCase(), entry);
  }
  return index;
}

/**
 * Resolves an `iconName` (e.g. `"etc_adena_i00"`) to an existing PNG basename
 * in `iconsDir` using a case-insensitive exact-match lookup. Returns `null`
 * when no file exists — never guesses or fuzzy-matches.
 */
export function resolveIconFile(
  iconName: string | null,
  iconsIndex: Map<string, string>
): string | null {
  if (!iconName) return null;
  return iconsIndex.get(`${iconName.toLowerCase()}.png`) ?? null;
}

/**
 * One-off audit tool: decode `data/datapack/interlude/itemname-e.dat`
 * (Lineage 2 client name table, encrypted Ver413 format) into raw bytes
 * for inspection.
 *
 * Format reference (well-known L2 client DAT layout):
 *   - 28-byte UTF-16LE header: `Lineage2Ver413`
 *   - rest of file: stream of 128-byte ciphertext blocks
 *   - per block: m = c^e mod n  (RSA, 1024-bit modulus, public exponent)
 *   - first 4 bytes of each decrypted block = big-endian uint32 with the
 *     payload byte-count for this block (≤ 124, because 128 - 4 header)
 *   - concatenated payload across all blocks: 4-byte LE uncompressed-size
 *     header followed by zlib-compressed UTF-16LE text body
 *
 * Two known L2 RSA parameter sets exist in the wild:
 *   - "original" client files     → exp 0x35
 *   - "modified" / re-saved files → exp 0x1d (different modulus)
 * We detect which one by trial: try modified first (most community
 * redistributions are modified), fall back to original.
 *
 * Output: writes raw decrypted bytes next to the input as
 * `itemname-e.decoded.bin`, and a UTF-8 text dump as
 * `itemname-e.decoded.txt`. Both are gitignored intentionally —
 * regeneratable from the .dat.
 *
 * This script is investigation tooling. It is NOT wired into
 * `scripts/build-data.ts`. Run with: `pnpm tsx scripts/audit/decode-itemname-dat.ts`.
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Public RSA parameters for L2 client DAT files (well-known, used by
// L2crypt / l2encdec / mxencdec / community PHP decoders).
const MOD_MODIFIED_B64 =
  "dbTW3lwBZUQGihrPElhp9D0uCfxVuLHiiVVtr5uHV2NVk0RiiLNlPaHOkch7saXBjxYyNJXFXX1ywIkKg/ab/R/ZQ06xwC8+Rnnt+kMwkxkHASnCZ8hWBNh7tluuIF3jcHrx0hCIgau1Z8Oz0GmuZ8OkxqOqk9JkE9TGYJSuIDk=";
const MOD_ORIGINAL_B64 =
  "l985hHLd9zfvCgzRfo0XLw/vFmGjiorh1ugpvBxuTDz8GSkt2p75AXXkbnOUoYhQtkF9A75u6idNPtHd5bXXvecswKC3HQNghlVjOIF5OgLJpn2e8rRet8CNS+MpCDzkUOaPeGe2dJMU1AUR0JvFdEVRuqhqidw4Ej3BZo/XLYM=";
const EXP_MODIFIED = 0x1dn;
const EXP_ORIGINAL = 0x35n;

const HEADER = "Lineage2Ver413";
const HEADER_BYTES = HEADER.length * 2; // UTF-16LE
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

function tryDecode(
  cipher: Buffer,
  modBytes: Buffer,
  exp: bigint
): Buffer | null {
  const mod = bytesToBigInt(modBytes);
  const payloadChunks: Buffer[] = [];
  // Trim any trailing footer that isn't a full RSA block (some L2 dumps
  // append a 20-byte signature/hash trailer after the last block).
  const usable = cipher.length - (cipher.length % BLOCK);
  for (let off = 0; off < usable; off += BLOCK) {
    const blk = cipher.subarray(off, off + BLOCK);
    const c = bytesToBigInt(blk);
    const m = modPow(c, exp, mod);
    const plain = bigIntToBytes(m, BLOCK);
    // First 4 bytes (BE uint32) = payload byte-count in this block.
    // Wrong-key sentinel: with the wrong RSA params, the result spans
    // all 128 bytes and the first 4 bytes will be a large garbage uint.
    const size = plain.readUInt32BE(0);
    if (size > BLOCK - 4) return null;
    payloadChunks.push(plain.subarray(4, 4 + size));
  }
  const concat = Buffer.concat(payloadChunks);
  if (concat.length < 4) return null;
  const uncompressedLen = concat.readUInt32LE(0);
  try {
    const inflated = zlib.inflateSync(concat.subarray(4));
    if (inflated.length !== uncompressedLen) {
      console.warn(
        `[decode-itemname-dat] inflated size ${inflated.length} != header ${uncompressedLen} — proceeding anyway`
      );
    }
    return inflated;
  } catch {
    return null;
  }
}

function main(): void {
  const root = process.cwd();
  const inPath = path.join(
    root,
    "data",
    "datapack",
    "interlude",
    "itemname-e.dat"
  );
  if (!fs.existsSync(inPath)) {
    console.error(`[decode-itemname-dat] not found: ${inPath}`);
    process.exit(1);
  }
  const buf = fs.readFileSync(inPath);
  // Verify header
  const head = buf.subarray(0, HEADER_BYTES).toString("utf16le");
  if (head !== HEADER) {
    console.error(
      `[decode-itemname-dat] unexpected header: ${JSON.stringify(head)} (expected ${JSON.stringify(HEADER)})`
    );
    process.exit(1);
  }
  const cipher = buf.subarray(HEADER_BYTES);

  const modModified = Buffer.from(MOD_MODIFIED_B64, "base64");
  const modOriginal = Buffer.from(MOD_ORIGINAL_B64, "base64");

  let decoded = tryDecode(cipher, modModified, EXP_MODIFIED);
  let used = "modified (exp 0x1d)";
  if (!decoded) {
    decoded = tryDecode(cipher, modOriginal, EXP_ORIGINAL);
    used = "original (exp 0x35)";
  }
  if (!decoded) {
    console.error(
      `[decode-itemname-dat] both RSA parameter sets failed — file may use a different scheme`
    );
    process.exit(1);
  }

  const outBin = path.join(path.dirname(inPath), "itemname-e.decoded.bin");
  fs.writeFileSync(outBin, decoded);
  // The body is UTF-16LE text; convert to UTF-8 for human inspection.
  const text = decoded.toString("utf16le").replace(/^\ufeff/, "");
  const outTxt = path.join(path.dirname(inPath), "itemname-e.decoded.txt");
  fs.writeFileSync(outTxt, text, "utf-8");

  console.log(`[decode-itemname-dat] OK (${used})`);
  console.log(`  ciphertext blocks:  ${cipher.length / BLOCK}`);
  console.log(`  inflated bytes:     ${decoded.length}`);
  console.log(`  utf-8 chars:        ${text.length}`);
  console.log(`  binary  → ${path.relative(root, outBin)}`);
  console.log(`  text    → ${path.relative(root, outTxt)}`);
}

main();

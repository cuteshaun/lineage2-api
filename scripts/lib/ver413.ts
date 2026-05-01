import fs from "node:fs";
import zlib from "node:zlib";

/**
 * Shared decoder for the L2 client `Lineage2Ver413` RSA + zlib envelope.
 * Used by every `*-e.dat` and `*grp.dat` ingestion in this repo
 * (item icons, item names, skill names, quest names, …).
 *
 * The envelope is well-known L2 client format. Two public RSA parameter
 * sets exist: `itemname-e.dat` / `questname-e.dat` use the "modified"
 * key (exp 0x1d); the `*grp.dat` tables use the "original" key (exp
 * 0x35). We try both and return the first that decrypts cleanly.
 *
 * The body parsing (record schema, field offsets, ustring layout) is
 * NOT shared — it's bespoke per-DAT and lives in each parser.
 */

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
  // Trim the 20-byte signature trailer that Ver413 dumps append after
  // the last full RSA block.
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
    // With the wrong key the first 4 bytes decode to a large garbage
    // uint — used as a sentinel to fall through to the next key.
    if (size > RSA_BLOCK - 4) return null;
    chunks.push(plain.subarray(4, 4 + size));
  }
  return chunks.length ? Buffer.concat(chunks) : null;
}

async function tolerantInflate(input: Buffer): Promise<Buffer> {
  // Ver413 signature-trailer truncation makes the last zlib block
  // report "unexpected end of file" even though every meaningful byte
  // decoded. Swallow the terminal error and return the partial output.
  return new Promise((resolve) => {
    const z = zlib.createInflate();
    const parts: Buffer[] = [];
    z.on("data", (c: Buffer) => parts.push(c));
    z.on("error", () => {});
    z.on("close", () => resolve(Buffer.concat(parts)));
    z.end(input);
  });
}

/**
 * Decrypt + inflate a `Lineage2Ver413` `.dat` file. Returns the
 * decompressed body buffer (UTF-16LE encoded for `-e.dat` files;
 * mixed binary + UTF-16LE ustrings for `*grp.dat` files).
 *
 * Throws when:
 * - the file is shorter than the 28-byte UTF-16 header,
 * - the header marker doesn't match `Lineage2Ver413`,
 * - both RSA parameter sets fail to decrypt.
 *
 * The caller (parser) chooses the prefix used in error messages by
 * passing it as `errorPrefix`. Defaults to `[ver413]`.
 */
export async function decodeVer413(
  datPath: string,
  errorPrefix: string = "[ver413]"
): Promise<Buffer> {
  const buf = fs.readFileSync(datPath);
  if (buf.length < FILE_HEADER_BYTES) {
    throw new Error(
      `${errorPrefix} file too short to contain Ver413 header: ${datPath}`
    );
  }
  const head = buf.subarray(0, FILE_HEADER_BYTES).toString("utf16le");
  if (head !== FILE_HEADER) {
    throw new Error(
      `${errorPrefix} unexpected Ver413 header in ${datPath}: ${JSON.stringify(head)}`
    );
  }
  const cipher = buf.subarray(FILE_HEADER_BYTES);
  const modModified = Buffer.from(MOD_MODIFIED_B64, "base64");
  const modOriginal = Buffer.from(MOD_ORIGINAL_B64, "base64");

  let concat = rsaDecryptBlocks(cipher, modModified, EXP_MODIFIED);
  if (!concat) concat = rsaDecryptBlocks(cipher, modOriginal, EXP_ORIGINAL);
  if (!concat) {
    throw new Error(
      `${errorPrefix} both RSA parameter sets failed for ${datPath}`
    );
  }
  // Decoded payload: `uint32 uncompLen` + zlib-deflate of body.
  return tolerantInflate(concat.subarray(4));
}

/** One UTF-16LE ustring located by `scanUtf16Ustrings`. */
export type Ustring = {
  /** Byte offset of the leading `int32` length in the decoded buffer. */
  off: number;
  /** First byte after the string (off + 4 + N where N is the byte length). */
  end: number;
  /** Decoded string (trailing nulls stripped). */
  s: string;
};

export interface ScanOptions {
  /**
   * Regex the decoded string must match to be accepted. Default
   * accepts strings of word/punctuation characters typical for grp
   * mesh and icon paths. Pass a more permissive regex for
   * narrative/quest text.
   */
  allowedRegex?: RegExp;
  /** Minimum string length (chars). Default 3. */
  minLen?: number;
  /** Maximum payload length (chars × 2 = bytes). Default 256. */
  maxBytes?: number;
}

const DEFAULT_REGEX = /^[A-Za-z0-9_.\- ]+$/;

/**
 * Scan a decoded buffer for length-prefixed UTF-16LE strings.
 * Layout: `int32 byteLen` followed by `byteLen` bytes (UTF-16LE).
 * Skips garbage by bounding `byteLen` and validating that every
 * byte pair has zero high-byte and a printable low-byte.
 *
 * The returned hits are non-overlapping (the scanner advances past
 * each accepted hit before resuming).
 */
export function scanUtf16Ustrings(
  buf: Buffer,
  opts: ScanOptions = {}
): Ustring[] {
  const allowedRegex = opts.allowedRegex ?? DEFAULT_REGEX;
  const minLen = opts.minLen ?? 3;
  const maxBytes = opts.maxBytes ?? 256;

  const hits: Ustring[] = [];
  for (let i = 0; i + 8 <= buf.length; i++) {
    const n = buf.readInt32LE(i);
    if (n < 4 || n > maxBytes || (n & 1) !== 0) continue;
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
    if (s.length < minLen) continue;
    if (!allowedRegex.test(s)) continue;
    hits.push({ off: i, end, s });
    i = end - 1;
  }
  return hits;
}
